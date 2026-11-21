"""
AstraGrade v3.0 — Stage 1: OpenCV Image Pre-processing Pipeline.

Key capabilities:
1. Auto-Crop Page Borders: Detects 4-point paper contour on dark desks and applies perspective warp.
2. Deskewing: Automated ink contour minimum-area bounding box rotation correction.
3. Shadow & Lighting Normalization: Background illumination estimation (dilate + median blur + division)
   to eliminate uneven desk/phone-photo shadows before CLAHE.
4. CLAHE Ink Amplification: Contrast Limited Adaptive Histogram Equalization + bilateral filtering.
5. Ruled Notebook Line Suppression: Horizontal morphological filter (50x1 rect) to remove ruled lines
   for clean OCR binarization while keeping handwriting & fraction bars intact.
6. Multi-Page PDF & Image Support: Renders ALL pages via pypdfium2 and returns per-page paths & URLs.
7. Synthetic handwritten sheet generator for instant offline testing and demos.
"""

import io
import shutil
import time
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple, Union
import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont


class PageResultList(list):
    """List of per-page pre-processing dictionaries.
    
    Provides backward compatibility with callers expecting a single-dict interface:
    `res["enhanced_image_url"]` returns `res[0]["enhanced_image_url"]`.
    """

    def __getitem__(self, key):
        if isinstance(key, str):
            if not self:
                raise KeyError(key)
            return self[0][key]
        return super().__getitem__(key)

    def get(self, key: str, default: Any = None) -> Any:
        if self:
            return self[0].get(key, default)
        return default


class ImagePreprocessor:
    """OpenCV + Pillow + pypdfium2 handwritten answer sheet preprocessor."""

    @staticmethod
    def pdf_bytes_to_pil_images(pdf_bytes: bytes, scale: float = 2.0) -> List[Image.Image]:
        """Renders every page of a PDF document to PIL RGB images using pypdfium2."""
        import pypdfium2 as pdfium
        import gc
        doc = pdfium.PdfDocument(pdf_bytes)
        images = []
        try:
            for i in range(len(doc)):
                page = doc[i]
                bitmap = page.render(scale=scale)
                images.append(bitmap.to_pil().convert("RGB"))
        finally:
            doc.close()
            gc.collect()
        return images

    @classmethod
    def auto_crop_page(cls, bgr_image: np.ndarray) -> np.ndarray:
        """Detect the largest paper sheet contour and apply a 4-point perspective warp.
        
        If a clear paper boundary (quadrilateral contour >= 25% of image area) is found,
        it crops and rectifies the sheet. Otherwise returns the original image.
        """
        if bgr_image is None or bgr_image.size == 0:
            return bgr_image

        h, w = bgr_image.shape[:2]
        img_area = h * w

        gray = cv2.cvtColor(bgr_image, cv2.COLOR_BGR2GRAY)
        blurred = cv2.GaussianBlur(gray, (7, 7), 0)
        edges = cv2.Canny(blurred, 30, 120)

        # Dilate edges slightly to bridge small gaps in paper borders
        kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (3, 3))
        edges = cv2.dilate(edges, kernel, iterations=1)

        contours, _ = cv2.findContours(edges, cv2.RETR_LIST, cv2.CHAIN_APPROX_SIMPLE)
        contours = sorted(contours, key=cv2.contourArea, reverse=True)[:8]

        for c in contours:
            area = cv2.contourArea(c)
            if area < 0.25 * img_area:
                continue

            peri = cv2.arcLength(c, True)
            approx = cv2.approxPolyDP(c, 0.02 * peri, True)

            if len(approx) == 4 and cv2.isContourConvex(approx):
                pts = approx.reshape(4, 2).astype(np.float32)

                # Order points: top-left, top-right, bottom-right, bottom-left
                s = pts.sum(axis=1)
                diff = np.diff(pts, axis=1)

                tl = pts[np.argmin(s)]
                br = pts[np.argmax(s)]
                tr = pts[np.argmin(diff)]
                bl = pts[np.argmax(diff)]

                # Compute width and height of new rectified image
                width_a = np.linalg.norm(br - bl)
                width_b = np.linalg.norm(tr - tl)
                max_w = max(int(width_a), int(width_b))

                height_a = np.linalg.norm(tr - br)
                height_b = np.linalg.norm(tl - bl)
                max_h = max(int(height_a), int(height_b))

                if max_w < 100 or max_h < 100:
                    continue

                # Orientation check: ensure portrait stays portrait, and top corners remain in upper half
                is_orig_portrait = h >= w
                is_warped_portrait = max_h >= max_w
                if is_orig_portrait != is_warped_portrait:
                    continue
                if tl[1] > h * 0.55 or tr[1] > h * 0.55 or br[1] < h * 0.45 or bl[1] < h * 0.45:
                    continue

                dst = np.array(
                    [
                        [0, 0],
                        [max_w - 1, 0],
                        [max_w - 1, max_h - 1],
                        [0, max_h - 1],
                    ],
                    dtype=np.float32,
                )
                src = np.array([tl, tr, br, bl], dtype=np.float32)
                M = cv2.getPerspectiveTransform(src, dst)
                warped = cv2.warpPerspective(
                    bgr_image, M, (max_w, max_h), flags=cv2.INTER_CUBIC, borderMode=cv2.BORDER_REPLICATE
                )
                return warped

        return bgr_image

    @staticmethod
    def deskew_with_angle(gray: np.ndarray) -> Tuple[np.ndarray, float]:
        """Deskew grayscale page using minimum-area bounding box on ink contours.
        
        Returns (deskewed_image, angle_degrees).
        """
        inv = cv2.bitwise_not(gray)
        thresh = cv2.threshold(inv, 0, 255, cv2.THRESH_BINARY | cv2.THRESH_OTSU)[1]
        coords = np.column_stack(np.where(thresh > 0))
        if coords.shape[0] < 100:
            return gray, 0.0

        angle = cv2.minAreaRect(coords)[-1]
        if angle < -45:
            angle = -(90 + angle)
        else:
            angle = -angle

        # Clamp deskew strictly to [-10.0, +10.0] - NEVER rotate by 90 or 180 degrees
        if abs(angle) < 0.15 or abs(angle) > 10.0:
            return gray, 0.0
        angle = max(-10.0, min(10.0, float(angle)))

        (h, w) = gray.shape[:2]
        center = (w // 2, h // 2)
        M = cv2.getRotationMatrix2D(center, angle, 1.0)
        deskewed = cv2.warpAffine(
            gray, M, (w, h), flags=cv2.INTER_CUBIC, borderMode=cv2.BORDER_REPLICATE
        )
        return deskewed, round(float(angle), 2)

    @classmethod
    def deskew_grayscale(cls, gray: np.ndarray) -> np.ndarray:
        """Deskews grayscale image and returns deskewed array (legacy backward compatibility)."""
        deskewed, _ = cls.deskew_with_angle(gray)
        return deskewed

    @classmethod
    def normalize_illumination(cls, gray: np.ndarray) -> np.ndarray:
        """Estimate background illumination via dilation + median blur and normalize.
        
        Eliminates uneven smartphone photo desk shadows before CLAHE equalization.
        """
        dilated = cv2.dilate(gray, np.ones((7, 7), np.uint8))
        bg = cv2.medianBlur(dilated, 21)
        bg = np.maximum(bg, 1)  # prevent division by zero
        normalized = cv2.divide(gray, bg, scale=255)
        return np.clip(normalized, 0, 255).astype(np.uint8)

    @classmethod
    def suppress_ruled_lines(cls, binary: np.ndarray) -> np.ndarray:
        """Non-destructive horizontal morphological filter for ruled notebook line suppression.
        
        Uses cv2.getStructuringElement(cv2.MORPH_RECT, (50, 1)) on a copy to detect
        long horizontal notebook ruling lines and suppress them, preventing OCR confusion
        while preserving handwriting strokes and fraction bars.
        """
        is_white_bg = np.mean(binary) > 127
        work_inv = cv2.bitwise_not(binary) if is_white_bg else binary.copy()

        horiz_kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (50, 1))
        detected_lines = cv2.morphologyEx(work_inv, cv2.MORPH_OPEN, horiz_kernel, iterations=2)

        cleaned_inv = cv2.subtract(work_inv, detected_lines)

        if is_white_bg:
            cleaned_binary = cv2.bitwise_not(cleaned_inv)
        else:
            cleaned_binary = cleaned_inv

        return cleaned_binary

    @classmethod
    def process_single_pil_page(
        cls,
        pil_img: Image.Image,
        output_dir: Path,
        stem_prefix: str,
        page_num: int = 1,
        fast: bool = True,
    ) -> Dict[str, Any]:
        """Runs the complete Stage 1 OpenCV pipeline on one page.
        
        When fast=True (default during upload ingestion), runs optimized fast rendering
        with level-1 PNG compression and fast CLAHE/binarization to complete under 1.5s total.
        """
        t_start = time.perf_counter()
        output_dir.mkdir(parents=True, exist_ok=True)

        orig_path = output_dir / f"{stem_prefix}_original.png"
        enhanced_path = output_dir / f"{stem_prefix}_clahe.png"
        binary_path = output_dir / f"{stem_prefix}_binary.png"

        # Convert PIL -> OpenCV BGR
        bgr = cv2.cvtColor(np.array(pil_img), cv2.COLOR_RGB2BGR)

        if fast:
            # Fast upload mode: level-1 PNG write, fast CLAHE and thresholding for sub-second page processing
            cv2.imwrite(str(orig_path), bgr, [cv2.IMWRITE_PNG_COMPRESSION, 1])
            gray = cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY)
            clahe = cv2.createCLAHE(clipLimit=2.2, tileGridSize=(8, 8)).apply(gray)
            cv2.imwrite(str(enhanced_path), clahe, [cv2.IMWRITE_PNG_COMPRESSION, 1])
            _, binary_clean = cv2.threshold(clahe, 175, 255, cv2.THRESH_BINARY)
            cv2.imwrite(str(binary_path), binary_clean, [cv2.IMWRITE_PNG_COMPRESSION, 1])
            angle = 0.0
        else:
            # Full heavy offline preprocessing
            pil_img.save(orig_path, format="PNG")
            cropped_bgr = cls.auto_crop_page(bgr)
            gray = cv2.cvtColor(cropped_bgr, cv2.COLOR_BGR2GRAY)
            deskewed, angle = cls.deskew_with_angle(gray)
            shadow_normalized = cls.normalize_illumination(deskewed)
            clahe = cv2.createCLAHE(clipLimit=2.6, tileGridSize=(8, 8))
            enhanced = clahe.apply(shadow_normalized)
            enhanced = cv2.bilateralFilter(enhanced, d=5, sigmaColor=35, sigmaSpace=35)
            cv2.imwrite(str(enhanced_path), enhanced)
            binary_raw = cv2.adaptiveThreshold(
                enhanced, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY, 25, 12
            )
            binary_clean = cls.suppress_ruled_lines(binary_raw)
            cv2.imwrite(str(binary_path), binary_clean)

        elapsed_ms = round((time.perf_counter() - t_start) * 1000, 1)

        return {
            "page_number": page_num,
            "original": str(orig_path),
            "clahe": str(enhanced_path),
            "binary": str(binary_path),
            "original_image_url": f"/uploads/{orig_path.name}",
            "enhanced_image_url": f"/uploads/{enhanced_path.name}",
            "binary_image_url": f"/uploads/{binary_path.name}",
            "deskew_angle": angle,
            "processing_time_ms": elapsed_ms,
        }

    @classmethod
    def process_answer_sheet(
        cls, input_path: Path, output_dir: Path, stem: str, fast: bool = True
    ) -> PageResultList:
        """Full multi-page PDF & phone-photo OpenCV pipeline.
        
        Renders ALL pages via pypdfium2 for PDFs (not just page 0).
        Uses fast=True during upload ingestion (< 1.5s).
        """
        output_dir.mkdir(parents=True, exist_ok=True)
        raw_bytes = input_path.read_bytes()

        scale = 0.75 if fast else 2.0
        if input_path.suffix.lower() == ".pdf":
            pages = cls.pdf_bytes_to_pil_images(raw_bytes, scale=scale)
        else:
            pages = [Image.open(io.BytesIO(raw_bytes)).convert("RGB")]

        results = PageResultList()

        for idx, pil_img in enumerate(pages, start=1):
            page_stem = f"{stem}_p{idx}"
            page_res = cls.process_single_pil_page(
                pil_img=pil_img,
                output_dir=output_dir,
                stem_prefix=page_stem,
                page_num=idx,
                fast=fast,
            )
            # For page 1, also copy to non-suffixed filenames for backward compatibility
            if idx == 1:
                default_orig = output_dir / f"{stem}_original.png"
                default_clahe = output_dir / f"{stem}_clahe.png"
                default_binary = output_dir / f"{stem}_binary.png"
                try:
                    shutil.copyfile(page_res["original"], default_orig)
                    shutil.copyfile(page_res["clahe"], default_clahe)
                    shutil.copyfile(page_res["binary"], default_binary)
                except Exception:
                    pass

            results.append(page_res)

        return results

    @classmethod
    def generate_synthetic_handwritten_sheet(
        cls,
        output_dir: Path,
        stem: str,
        student_name: str,
        roll_number: str,
        exam_code: str,
        answers_payload: List[Dict],
        ink_rgb: Tuple[int, int, int] = (24, 52, 135),
    ) -> PageResultList:
        """Renders an authentic lined university exam booklet page with handwritten-style answers,
        margin question numbers, bounding boxes, and crossed-out scratch words, then runs OpenCV CLAHE."""
        output_dir.mkdir(parents=True, exist_ok=True)
        W, H = 1100, 1520
        rng = np.random.default_rng(abs(hash(roll_number)) % 10000)
        paper = np.full((H, W, 3), (249, 247, 240), dtype=np.uint8)
        noise = rng.integers(-4, 5, size=(H, W, 3), dtype=np.int16)
        paper = np.clip(paper.astype(np.int16) + noise, 232, 255).astype(np.uint8)

        img = Image.fromarray(paper)
        draw = ImageDraw.Draw(img)

        # Load fonts
        font_paths = [
            "C:/Windows/Fonts/arial.ttf",
            "C:/Windows/Fonts/calibri.ttf",
            "/usr/share/fonts/truetype/dejavu/DejaVuSans-Oblique.ttf",
            "/usr/share/fonts/truetype/liberation/LiberationSerif-Italic.ttf",
            "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
        ]
        bold_paths = [
            "C:/Windows/Fonts/arialbd.ttf",
            "C:/Windows/Fonts/calibrib.ttf",
            "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
            "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
        ]
        mono_paths = [
            "C:/Windows/Fonts/consola.ttf",
            "/usr/share/fonts/truetype/dejavu/DejaVuSansMono-Bold.ttf",
        ]

        def pick_font(paths, size):
            for p in paths:
                if Path(p).exists():
                    try:
                        return ImageFont.truetype(p, size)
                    except Exception:
                        pass
            return ImageFont.load_default()

        font_hw = pick_font(font_paths, 20)
        font_hw_sm = pick_font(font_paths, 17)
        font_hdr = pick_font(bold_paths, 20)
        font_sub = pick_font(mono_paths, 15)

        # University Exam Header Box
        draw.rectangle([40, 32, W - 40, 165], outline=(60, 70, 90), width=2)
        draw.text((60, 46), f"UNIVERSITY EXAMINATION BOOKLET — {exam_code}", fill=(35, 42, 60), font=font_hdr)
        draw.text((60, 84), f"CANDIDATE NAME: {student_name}", fill=ink_rgb, font=font_hw)
        draw.text((520, 84), f"ROLL NO: {roll_number}", fill=ink_rgb, font=font_hw)
        draw.text((60, 122), f"EXAM CODE: {exam_code}   |   BOOKLET QR: QR-{roll_number}-2026", fill=(70, 80, 100), font=font_sub)

        # Simulated QR / Barcode Box in Top Right
        qr_x, qr_y = W - 155, 44
        draw.rectangle([qr_x, qr_y, qr_x + 98, qr_y + 98], outline=(30, 30, 30), width=2)
        for r in range(7):
            for c in range(7):
                if (r + c + len(roll_number)) % 2 == 0:
                    draw.rectangle(
                        [qr_x + 8 + c * 12, qr_y + 8 + r * 12, qr_x + 18 + c * 12, qr_y + 18 + r * 12],
                        fill=(25, 30, 40),
                    )

        # Double Red Vertical Margin Line + Horizontal Ruled Blue Lines
        margin_x = 128
        draw.line([(margin_x, 175), (margin_x, H - 40)], fill=(210, 95, 95), width=2)
        draw.line([(margin_x + 6, 175), (margin_x + 6, H - 40)], fill=(210, 95, 95), width=1)

        for y in range(205, H - 40, 34):
            draw.line([(40, y), (W - 40, y)], fill=(196, 212, 232), width=1)

        # Render each Question Answer in its spatial vertical band
        for idx, item in enumerate(answers_payload):
            q_num = item["question_number"]
            text = item["transcribed_text"]
            crossed = item.get("strikethrough_ignored", [])
            bbox = item.get("bbox_json", {})
            y_start = int((bbox.get("y_pct", 14 + idx * 21) / 100.0) * H)
            y_cur = max(210, y_start)

            # Margin Question Badge
            draw.ellipse([54, y_cur - 4, 114, y_cur + 32], outline=ink_rgb, width=2)
            draw.text((68, y_cur + 2), f"{q_num})", fill=ink_rgb, font=font_hdr)

            # Optional crossed-out scratch line above or beside answer
            x_cur = margin_x + 24
            if crossed:
                scratch_str = " ".join(crossed)
                draw.text((x_cur, y_cur), scratch_str, fill=(95, 110, 155), font=font_hw_sm)
                tw = len(scratch_str) * 9
                draw.line([(x_cur - 2, y_cur + 11), (x_cur + tw, y_cur + 13)], fill=(30, 45, 115), width=3)
                draw.line([(x_cur - 2, y_cur + 16), (x_cur + tw, y_cur + 9)], fill=(30, 45, 115), width=2)
                y_cur += 34

            # Wrap and render handwritten lines with organic baseline jitter
            words = text.split()
            lines = []
            curr_line = []
            for w in words:
                curr_line.append(w)
                if len(" ".join(curr_line)) > 68:
                    lines.append(" ".join(curr_line[:-1]))
                    curr_line = [w]
            if curr_line:
                lines.append(" ".join(curr_line))

            for l_i, line_str in enumerate(lines[:6]):
                jitter_x = int(rng.integers(-3, 4))
                jitter_y = int(rng.integers(-2, 3))
                draw.text((x_cur + jitter_x, y_cur + jitter_y), line_str, fill=ink_rgb, font=font_hw)
                y_cur += 34

            # Divider dash at end of answer
            draw.line([(margin_x + 180, y_cur + 6), (W - 220, y_cur + 6)], fill=(150, 165, 195), width=1)

        orig_file = output_dir / f"{stem}.png"
        img.save(orig_file, format="PNG")
        return cls.process_answer_sheet(orig_file, output_dir, stem)
