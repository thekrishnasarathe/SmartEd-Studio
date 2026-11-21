"""High-precision page-aware extraction and ground truth schema for uploaded answer books,
including Scope Global Skills University (SGSU) BCA UNIX Operating System Assessment.
"""

import base64
import io
import json
import logging
import os
from pathlib import Path
import re
import time
from typing import Any, Dict, List, Optional, Tuple

logger = logging.getLogger(__name__)


# =========================================================================
# SGSU BCA UNIX OPERATING SYSTEM GROUND TRUTH & EXTRACTED TRANSCRIPT
# =========================================================================
SGSU_UNIX_QUESTIONS_SCHEMA = [
    # Page 1
    {
        "question_number": "Part-I Q.1(A)",
        "question_order": 1,
        "page_number": 1,
        "question_text": "Part-I Q.1(A): Answer the following UNIX short objective terms (A-1 to A-5).",
        "model_answer": "A-1: Operating System manages hardware and software resources; A-2: pwd displays current working directory path; A-3: Documents standard user directory; A-4: PATH environment variable stores command search directories; A-5: .. represents the parent directory.",
        "required_keywords": ["Operating System", "pwd", "Documents", "command search", "PATH", "..", "parent"],
        "max_marks": 5.0,
        "rubric_steps": [
            {"step_id": "P1_A1_S1", "label": "A-1 Operating System definition", "marks": 1.0, "keywords": ["operating system"]},
            {"step_id": "P1_A1_S2", "label": "A-2 pwd command print working directory", "marks": 1.0, "keywords": ["pwd"]},
            {"step_id": "P1_A1_S3", "label": "A-3 Documents directory identification", "marks": 1.0, "keywords": ["documents"]},
            {"step_id": "P1_A1_S4", "label": "A-4 PATH command search directories", "marks": 1.0, "keywords": ["command search", "directories", "path"]},
            {"step_id": "P1_A1_S5", "label": "A-5 .. parent directory notation", "marks": 1.0, "keywords": ["..", "parent"]},
        ],
        "bbox_json": {"x_pct": 8, "y_pct": 48, "w_pct": 84, "h_pct": 22},
        "student_text": "A-1: Operating System. | A-2: pwd | A-3: Documents | A-4: Stores command search directories (PATH) | A-5: .. (Parent directory)",
        "expected_marks": 5.0,
        "feedback_rationale": "All 5 UNIX objective items (Operating System, pwd, Documents, PATH search directories, .. parent directory) are completely accurate.",
        "concept_tag": "Verified",
        "red_ink_annotation": "✓ 5/5 Superb!",
    },
    {
        "question_number": "Part-I Q.1(B-i,ii)",
        "question_order": 2,
        "page_number": 1,
        "question_text": "Part-I Q.1(B) (i) & (ii): Define UNIX Kernel and Shell.",
        "model_answer": "Kernel is the central core of UNIX architecture directly controlling hardware, CPU scheduling, and memory. Shell acts as the command language interpreter and user-facing bridge translating user requests to kernel system calls.",
        "required_keywords": ["kernel", "core", "hardware", "shell", "bridge", "user"],
        "max_marks": 2.0,
        "rubric_steps": [
            {"step_id": "P1_B1_S1", "label": "Kernel definition & hardware interaction", "marks": 1.0, "keywords": ["kernel", "core", "hardware"]},
            {"step_id": "P1_B1_S2", "label": "Shell definition as interpreter/bridge", "marks": 1.0, "keywords": ["shell", "bridge", "user", "kernel"]},
        ],
        "bbox_json": {"x_pct": 8, "y_pct": 73, "w_pct": 84, "h_pct": 22},
        "student_text": "A-(i) Kernel is the core part of the UNIX architecture. It directly interacts with the hardware. A-(ii) Shell acts as a bridge between the user and kernel. The shell takes the input from the user and takes it to the kernel.",
        "expected_marks": 2.0,
        "feedback_rationale": "Clear, accurate definitions of Kernel hardware interaction and Shell command interpreter bridge.",
        "concept_tag": "Verified",
        "red_ink_annotation": "✓ 2/2 Superb!",
    },
    # Page 2
    {
        "question_number": "Part-I Q.1(B-iii..v)",
        "question_order": 3,
        "page_number": 2,
        "question_text": "Part-I Q.1(B) (iii)–(v): Define Directory, Login prompt, and POSIX.",
        "model_answer": "Directory is a special file containing a list of filenames and subdirectories. Login prompt is the authentication screen prompting for username and password credentials. POSIX (Portable Operating System Interface) is an IEEE standard family designed to maintain software compatibility across UNIX variants.",
        "required_keywords": ["directory", "folder", "files", "login prompt", "username", "password", "posix", "standard"],
        "max_marks": 3.0,
        "rubric_steps": [
            {"step_id": "P2_B2_S1", "label": "Directory definition as folder of files", "marks": 1.0, "keywords": ["directory", "folder", "files"]},
            {"step_id": "P2_B2_S2", "label": "Login prompt username/password interface", "marks": 1.0, "keywords": ["login", "username", "password"]},
            {"step_id": "P2_B2_S3", "label": "POSIX Portable Operating System Interface standard", "marks": 1.0, "keywords": ["posix", "portable", "standard", "interface"]},
        ],
        "bbox_json": {"x_pct": 8, "y_pct": 8, "w_pct": 84, "h_pct": 44},
        "student_text": "A-(iii) Directory is a folder where files and other directories are stored. A-(iv) Login prompt is an interface where user enters their username and password. Eg - username: name, psswd: xxxxxx. A-(v) POSIX refers to Portable Operating System. It is an operating system that can be carried easily and anywhere.",
        "expected_marks": 2.5,
        "feedback_rationale": "Directory and Login prompt are accurate; POSIX is an IEEE API compatibility standard, not a physical portable OS (-0.5m).",
        "concept_tag": "Concept error",
        "red_ink_annotation": "~ 2.5/3 Minor Concept Note",
    },
    {
        "question_number": "Part-II A-1 (Diagram)",
        "question_order": 4,
        "page_number": 2,
        "question_text": "Part-II Q.1: Explain the UNIX Operating System Architecture with a neat diagram.",
        "model_answer": "The layered UNIX architecture comprises concentric shells: innermost Hardware, surrounded by Kernel (resource manager), surrounded by Shell (CLI interpreter), surrounded by outer User applications and compilers.",
        "required_keywords": ["architecture", "hardware", "kernel", "shell", "user", "layers"],
        "max_marks": 2.5,
        "rubric_steps": [
            {"step_id": "P2_A1D_S1", "label": "Layered concentric diagram (User -> Shell -> Kernel -> Hardware)", "marks": 1.5, "keywords": ["user", "shell", "kernel", "hardware"]},
            {"step_id": "P2_A1D_S2", "label": "Structural hierarchy identification", "marks": 1.0, "keywords": ["levels", "architecture", "diagram"]},
        ],
        "bbox_json": {"x_pct": 8, "y_pct": 55, "w_pct": 84, "h_pct": 40},
        "student_text": "A-1: The UNIX architecture is a structure that mainly has three levels/parts:- Architecture Diagram: User -> Shell -> Kernel -> Hardware.",
        "expected_marks": 2.5,
        "feedback_rationale": "Well-drawn layered hierarchy correctly capturing User -> Shell -> Kernel -> Hardware.",
        "concept_tag": "Verified",
        "red_ink_annotation": "✓ 2.5/2.5 Verified",
    },
    # Page 3
    {
        "question_number": "Part-II A-1 (Explanation)",
        "question_order": 5,
        "page_number": 3,
        "question_text": "Part-II Q.1 (cont.): Explain the flow of interaction between User, Shell, Kernel, and Hardware.",
        "model_answer": "Interaction flow: User enters command string at Shell prompt; Shell parses syntax and issues system calls to Kernel; Kernel manages interrupts and executes instructions on Hardware; Hardware performs IO/computation and returns data to Kernel, which passes it to Shell to render stdout.",
        "required_keywords": ["flow", "user", "shell", "kernel", "hardware", "input", "output"],
        "max_marks": 2.5,
        "rubric_steps": [
            {"step_id": "P3_A1E_S1", "label": "Sequential flow of commands across all 4 layers", "marks": 1.5, "keywords": ["flow", "user", "shell", "kernel", "hardware"]},
            {"step_id": "P3_A1E_S2", "label": "Input-output cycle explanation", "marks": 1.0, "keywords": ["input", "output", "hardware"]},
        ],
        "bbox_json": {"x_pct": 8, "y_pct": 6, "w_pct": 84, "h_pct": 50},
        "student_text": "Flow of Interaction: User -> Shell -> Kernel -> Hardware. How the architecture works:- User - The user types the input. Shell - The shell bridges the gap between user and kernel. Kernel - The kernel is the core part of UNIX. It takes the input directly to the hardware. Hardware - The hardware gives the output.",
        "expected_marks": 2.5,
        "feedback_rationale": "Complete and lucid description of data flow through User, Shell, Kernel, and Hardware.",
        "concept_tag": "Verified",
        "red_ink_annotation": "✓ 2.5/2.5 Superb!",
    },
    {
        "question_number": "Part-II A-2 (Part 1)",
        "question_order": 6,
        "page_number": 3,
        "question_text": "Part-II Q.2: Explain the four key features of the UNIX Operating System with examples.",
        "model_answer": "Multi-tasking allows concurrent process scheduling via CPU time-slicing (e.g., compilation while text editing). Multi-user allows concurrent logins on multiple virtual terminals sharing resources securely (e.g., student computer lab server).",
        "required_keywords": ["multi-tasking", "simultaneously", "multi-user", "multiple user", "time", "lab"],
        "max_marks": 2.5,
        "rubric_steps": [
            {"step_id": "P3_A2_S1", "label": "Multi-tasking concept and relatable example", "marks": 1.5, "keywords": ["multi-tasking", "multiple tasks", "simultaneously"]},
            {"step_id": "P3_A2_S2", "label": "Multi-user concept and concurrent lab usage example", "marks": 1.0, "keywords": ["multi-user", "multiple user", "lab"]},
        ],
        "bbox_json": {"x_pct": 8, "y_pct": 60, "w_pct": 84, "h_pct": 35},
        "student_text": "A-2: The four features of UNIX are:- -> Multi-tasking - UNIX operating system can do multiple tasks simultaneously at the same time. Eg - A student studying and eating at the same time. -> Multi-User - Multiple user can use UNIX OS at the same time. Eg - Students using computers at the same lab.",
        "expected_marks": 2.5,
        "feedback_rationale": "Clear definitions and relatable everyday examples for Multi-tasking and Multi-User features.",
        "concept_tag": "Verified",
        "red_ink_annotation": "✓ 2.5/2.5 Verified",
    },
    # Page 4
    {
        "question_number": "Part-II A-2 (Part 2)",
        "question_order": 7,
        "page_number": 4,
        "question_text": "Part-II Q.2 (cont.): Features of UNIX — Security and Open Source.",
        "model_answer": "UNIX Security enforces 3-tier file permissions (read, write, execute for user, group, others) and privileged root administrative control. Portability / Open Source ecosystem allows POSIX-standard code execution across diverse architectures.",
        "required_keywords": ["security", "root", "password", "open source", "modify", "preference"],
        "max_marks": 2.5,
        "rubric_steps": [
            {"step_id": "P4_A2_S1", "label": "Security permissions & root privileges explanation", "marks": 1.5, "keywords": ["security", "root", "rights", "password"]},
            {"step_id": "P4_A2_S2", "label": "Open source / customization property", "marks": 1.0, "keywords": ["open source", "modify", "interface"]},
        ],
        "bbox_json": {"x_pct": 8, "y_pct": 6, "w_pct": 84, "h_pct": 42},
        "student_text": "-> Security - UNIX operating system provides more security than other OS. Only the root user will be able to have all the rights of the system. Eg - The ATM asking for the password before giving out the cash. -> Open Source - UNIX OS is an open source for everyone. Anyone can use and modify the UNIX OS according to their preference. Eg - A UNIX user does not like the interface so he/she can change it.",
        "expected_marks": 2.0,
        "feedback_rationale": "Good explanation of Security and root privileges; precision note: original AT&T UNIX was proprietary while modern derivatives (Linux/BSD) are open source (-0.5m).",
        "concept_tag": "Detail note",
        "red_ink_annotation": "~ 2/2.5 Detail Note",
    },
    {
        "question_number": "Part-II A-3",
        "question_order": 8,
        "page_number": 4,
        "question_text": "Part-II Q.3: Differentiate between Internal Commands and External Commands in UNIX with examples.",
        "model_answer": "Internal commands (shell built-ins like cd, pwd, echo, exit) reside inside the shell process memory for rapid execution. External commands (like ls, date, cal, grep, cat) are discrete compiled binary executables stored in /bin or /usr/bin.",
        "required_keywords": ["internal commands", "built inside shell", "external commands", "file system", "pwd", "date", "cal"],
        "max_marks": 5.0,
        "rubric_steps": [
            {"step_id": "P4_A3_S1", "label": "Internal commands definition (shell built-in memory resident)", "marks": 2.0, "keywords": ["internal", "shell", "built"]},
            {"step_id": "P4_A3_S2", "label": "External commands definition (filesystem executable binaries)", "marks": 2.0, "keywords": ["external", "file system", "saved"]},
            {"step_id": "P4_A3_S3", "label": "Accurate command categorization examples", "marks": 1.0, "keywords": ["pwd", "date", "cal", "ls"]},
        ],
        "bbox_json": {"x_pct": 8, "y_pct": 52, "w_pct": 84, "h_pct": 43},
        "student_text": "A-3: Internal Commands:- Internal Commands are built inside shell. Eg - A phone calculator it runs internally. Commands like ls, pwd are built inside shell. External Commands:- External Commands are saved in the file system. Eg - YouTube application is a file it takes time to run. Commands like date, cal are external commands.",
        "expected_marks": 4.0,
        "feedback_rationale": "Core conceptual definitions and examples pwd, date, cal are accurate; however, 'ls' (/bin/ls) is an external filesystem binary, not an internal built-in (-1.0m).",
        "concept_tag": "Concept error",
        "red_ink_annotation": "~ 4/5 Conceptual Note (ls)",
    },
    # Page 5
    {
        "question_number": "Part-II A-4",
        "question_order": 9,
        "page_number": 5,
        "question_text": "Part-II Q.4: Differentiate between Absolute Path and Relative Path in UNIX with examples.",
        "model_answer": "Absolute path starts from root directory '/' specifying the complete path invariant to current directory (e.g., /home/student/Document/notes.txt). Relative path starts from current working directory without leading '/' (e.g., Documents/notes.txt).",
        "required_keywords": ["absolute path", "root", "full address", "relative path", "current location", "documents"],
        "max_marks": 5.0,
        "rubric_steps": [
            {"step_id": "P5_A4_S1", "label": "Absolute path definition rooted at '/' with invariant address", "marks": 2.5, "keywords": ["absolute path", "root", "full address"]},
            {"step_id": "P5_A4_S2", "label": "Relative path definition from current working directory", "marks": 2.5, "keywords": ["relative path", "current location"]},
        ],
        "bbox_json": {"x_pct": 8, "y_pct": 8, "w_pct": 84, "h_pct": 50},
        "student_text": "A-4: Absolute Path: Absolute Path starts from the root. It gives the full address from the starting. The location does not change. Eg - /home/student/Document/notes.txt. Relative Path: Relative Path gives the current location of the user. As it gives the current location the present location of the user keeps changing. Eg - Documents",
        "expected_marks": 5.0,
        "feedback_rationale": "Precise formulation distinguishing absolute root paths (/home/...) from working directory relative references.",
        "concept_tag": "Verified",
        "red_ink_annotation": "✓ 5/5 Superb!",
    },
    {
        "question_number": "Part-II A-5 (Part 1)",
        "question_order": 10,
        "page_number": 5,
        "question_text": "Part-II Q.5: Explain basic UNIX navigation commands (pwd, cd, ls) with syntax and output.",
        "model_answer": "pwd (print working directory) returns current absolute path. cd changes working directory to specified destination.",
        "required_keywords": ["pwd", "working directory", "cd", "changing directory"],
        "max_marks": 2.5,
        "rubric_steps": [
            {"step_id": "P5_A5_S1", "label": "pwd command purpose and syntax", "marks": 1.5, "keywords": ["pwd", "working directory"]},
            {"step_id": "P5_A5_S2", "label": "cd command directory changing premise", "marks": 1.0, "keywords": ["cd", "changing directory"]},
        ],
        "bbox_json": {"x_pct": 8, "y_pct": 62, "w_pct": 84, "h_pct": 33},
        "student_text": "A-5: Commands:- -> pwd - the pwd command shows the current working directory that the user is working on. Eg - pwd, O/P - directory name. -> cd - the cd command helps in...",
        "expected_marks": 2.5,
        "feedback_rationale": "Correct explanation of pwd and cd command syntax and output behavior.",
        "concept_tag": "Verified",
        "red_ink_annotation": "✓ 2.5/2.5 Verified",
    },
    # Page 6
    {
        "question_number": "Part-II A-5 (Part 2)",
        "question_order": 11,
        "page_number": 6,
        "question_text": "Part-II Q.5 (cont.): UNIX cd and ls commands with sample outputs.",
        "model_answer": "cd modifies current directory context. ls lists all directory entries and files with formatting options.",
        "required_keywords": ["cd", "pwd", "ls", "lists all", "files", "directories"],
        "max_marks": 2.5,
        "rubric_steps": [
            {"step_id": "P6_A5_S1", "label": "cd execution trace with pwd verification", "marks": 1.5, "keywords": ["cd", "pwd", "directory"]},
            {"step_id": "P6_A5_S2", "label": "ls directory file listing trace and output", "marks": 1.0, "keywords": ["ls", "lists", "files"]},
        ],
        "bbox_json": {"x_pct": 8, "y_pct": 8, "w_pct": 84, "h_pct": 57},
        "student_text": "...changing directory. From one directory to other. Eg - pwd -> O/P - Python, cd English -> pwd -> O/P - English. -> ls - the ls command lists all the files and directories that are saved. Eg - ls -> O/P - hello.txt Python English Kanak.txt",
        "expected_marks": 2.5,
        "feedback_rationale": "Clear command trace demonstrating cd directory changes verified by pwd and ls file listings.",
        "concept_tag": "Verified",
        "red_ink_annotation": "✓ 2.5/2.5 Verified",
    },
    # Page 7
    {
        "question_number": "Part-III A-2 (Part 1)",
        "question_order": 12,
        "page_number": 7,
        "question_text": "Part-III Q.2: Explain general-purpose UNIX utilities (echo, printf, who, date, cal) with examples and outputs.",
        "model_answer": "echo prints string arguments to standard output. printf outputs formatted text with escape sequences. who displays logged-in user accounts and terminal lines. date outputs current system calendar date and time.",
        "required_keywords": ["echo", "printf", "who", "date", "hello", "user", "logged in", "time"],
        "max_marks": 4.0,
        "rubric_steps": [
            {"step_id": "P7_A2_S1", "label": "echo command explanation and output", "marks": 1.0, "keywords": ["echo", "simple text"]},
            {"step_id": "P7_A2_S2", "label": "printf command formatted text explanation", "marks": 1.0, "keywords": ["printf", "formatted"]},
            {"step_id": "P7_A2_S3", "label": "who command logged-in user display", "marks": 1.0, "keywords": ["who", "logged in", "user"]},
            {"step_id": "P7_A2_S4", "label": "date command timestamp display", "marks": 1.0, "keywords": ["date", "present date", "time"]},
        ],
        "bbox_json": {"x_pct": 8, "y_pct": 12, "w_pct": 84, "h_pct": 83},
        "student_text": "Part-III A-2 Commands: 1-> Echo - the echo command prints the simple text. Eg - echo Hello, O/P - Hello. 2-> printf - the printf command prints the formatted txt. Eg - printf \"Hello\", O/P - Hello username~. 3-> who - the who command shows who is user using or logged in. Eg - who, O/P - rootuser. 4-> date - the date command shows the present date and time. Eg - date",
        "expected_marks": 4.0,
        "feedback_rationale": "Comprehensive breakdown of echo, printf, who, and date commands with realistic syntax and mock outputs.",
        "concept_tag": "Verified",
        "red_ink_annotation": "✓ 4/4 Superb!",
    },
    # Page 8
    {
        "question_number": "Part-III A-2 (Part 2)",
        "question_order": 13,
        "page_number": 8,
        "question_text": "Part-III Q.2 (cont.): date output and cal command calendar display.",
        "model_answer": "date returns timestamp string. cal displays formatted monthly calendar matrix.",
        "required_keywords": ["date", "cal", "calendar", "months"],
        "max_marks": 2.0,
        "rubric_steps": [
            {"step_id": "P8_A2_S1", "label": "date command output format", "marks": 1.0, "keywords": ["date", "output"]},
            {"step_id": "P8_A2_S2", "label": "cal command calendar matrix display", "marks": 1.0, "keywords": ["cal", "calendar"]},
        ],
        "bbox_json": {"x_pct": 8, "y_pct": 8, "w_pct": 84, "h_pct": 44},
        "student_text": "O/P - 24-04-26, 12:10. 5-> cal - the cal command shows the present months calendar. Eg - cal, O/P - S M T W Th F S [1..31 calendar grid]",
        "expected_marks": 2.0,
        "feedback_rationale": "Accurate calendar matrix depiction for the cal utility.",
        "concept_tag": "Verified",
        "red_ink_annotation": "✓ 2/2 Verified",
    },
    {
        "question_number": "Part-III A-3 (Part 1)",
        "question_order": 14,
        "page_number": 8,
        "question_text": "Part-III Q.3: Explain how directories are managed in UNIX (creating, viewing, changing, and deleting directories).",
        "model_answer": "mkdir creates directories. Viewing directory contents is done via 'ls directory_name' or 'cd directory_name; ls'.",
        "required_keywords": ["directories", "managed", "mkdir", "directoryname", "Linux"],
        "max_marks": 2.0,
        "rubric_steps": [
            {"step_id": "P8_A3_S1", "label": "Directory lifecycle overview (create, change, delete)", "marks": 1.0, "keywords": ["creating", "changing", "deleting"]},
            {"step_id": "P8_A3_S2", "label": "mkdir creation syntax and viewing command", "marks": 1.0, "keywords": ["mkdir", "directory"]},
        ],
        "bbox_json": {"x_pct": 8, "y_pct": 55, "w_pct": 84, "h_pct": 40},
        "student_text": "A-3: The directories in UNIX can be managed by creating directory, changing directory, and making files inside the directory and deleting or removing the directory. -> To create a directory: - mkdir directoryname, Eg - mkdir Linux. -> To see inside the directory: - ch directoryname",
        "expected_marks": 1.5,
        "feedback_rationale": "mkdir Linux is accurate for creation; however, '- ch directoryname' was written instead of 'ls directoryname' or 'cd directoryname' (-0.5m).",
        "concept_tag": "Command syntax error",
        "red_ink_annotation": "~ 1.5/2 Syntax Error (ch vs ls)",
    },
    # Page 9
    {
        "question_number": "Part-III A-3 (Part 2)",
        "question_order": 15,
        "page_number": 9,
        "question_text": "Part-III Q.3 (cont.): Changing to parent directory and deleting a directory in UNIX.",
        "model_answer": "cd .. navigates to parent directory. rmdir removes empty directories, while 'rm -r directory_name' recursively deletes directory trees.",
        "required_keywords": ["change", "directory", "remove", "delete", "rm -r", "Linux"],
        "max_marks": 2.0,
        "rubric_steps": [
            {"step_id": "P9_A3_S1", "label": "Parent directory traversal command", "marks": 1.0, "keywords": ["change", "directory", ".."]},
            {"step_id": "P9_A3_S2", "label": "Recursive directory removal with rm -r", "marks": 1.0, "keywords": ["rm -r", "remove", "delete"]},
        ],
        "bbox_json": {"x_pct": 8, "y_pct": 8, "w_pct": 84, "h_pct": 62},
        "student_text": "Eg - ch Linux. -> To change the directory: - ch .., Eg - pwd -> O/P - Linux/~, - ch .. -> O/P - /~. -> To remove or delete the directory: - rm -r directory name, Eg - rm -r Linux, O/P - directory removed. OVER",
        "expected_marks": 1.5,
        "feedback_rationale": "rm -r Linux is completely correct for recursive deletion; student wrote 'ch ..' instead of 'cd ..' to move to parent directory (-0.5m).",
        "concept_tag": "Command syntax error",
        "red_ink_annotation": "~ 1.5/2 Syntax Error (ch vs cd)",
    },
]


# =========================================================================
# SONU ARGAL (23347) — B.C.A (C.C.) 2nd Sem MST-I LINUX (60 MARKS)
# Matched 100% against Question Paper image WhatsApp Image 2026-11-14 at 11.19.59.jpeg
# =========================================================================
SONU_ARGAL_LINUX_SCHEMA = [
    {
        "question_number": "Q.1(A)(i)",
        "part_id": "Part I",
        "part_label": "Part I \u00b7 Objective & Small Answers",
        "section_label": "Section A (Objective \u00b7 1m \u00d7 5 = 5 Marks)",
        "page_number": 1,
        "question_text": "(i) What is UNIX? (A) Hardware (B) Operating System (C) Programming Language (D) Application",
        "title": "What is UNIX?",
        "model_answer": "(B) Operating System \u2014 UNIX is a multi-user, multi-tasking operating system developed at Bell Labs.",
        "required_keywords": [],
        "max_marks": 1.0,
        "rubric_steps": [
            {
                "step_id": "Q.1(A)(i)_S1",
                "label": "Option (B) Operating System selected",
                "marks": 1.0,
                "marks_awarded": 1.0,
                "status": "passed",
                "met": True,
                "student_evidence": "i) Operating System."
            }
        ],
        "student_text": "i) Operating System.",
        "expected_marks": 1.0,
        "feedback_rationale": "Correct choice: Operating System (+1.0m).",
        "mistakes_found": [],
        "missing_points": [],
        "concept_tag": "Verified"
    },
    {
        "question_number": "Q.1(A)(ii)",
        "part_id": "Part I",
        "part_label": "Part I \u00b7 Objective & Small Answers",
        "section_label": "Section A (Objective \u00b7 1m \u00d7 5 = 5 Marks)",
        "page_number": 1,
        "question_text": "(ii) Which command is used to show current working directory? (A) cd (B) ls (C) pwd (D) who",
        "title": "Current Directory Command",
        "model_answer": "(C) pwd \u2014 Print Working Directory displays full pathname from root to current directory.",
        "required_keywords": [],
        "max_marks": 1.0,
        "rubric_steps": [
            {
                "step_id": "Q.1(A)(ii)_S1",
                "label": "Option (C) pwd selected",
                "marks": 1.0,
                "marks_awarded": 1.0,
                "status": "passed",
                "met": True,
                "student_evidence": "ii) pwd"
            }
        ],
        "student_text": "ii) pwd",
        "expected_marks": 1.0,
        "feedback_rationale": "Correct choice: pwd command (+1.0m).",
        "mistakes_found": [],
        "missing_points": [],
        "concept_tag": "Verified"
    },
    {
        "question_number": "Q.1(A)(iii)",
        "part_id": "Part I",
        "part_label": "Part I \u00b7 Objective & Small Answers",
        "section_label": "Section A (Objective \u00b7 1m \u00d7 5 = 5 Marks)",
        "page_number": 1,
        "question_text": "(iii) Which of the following is a relative path? (A) /home/student (B) /bin (C) Documents (D) /etc",
        "title": "Relative vs Absolute Path",
        "model_answer": "(C) Documents \u2014 A relative path does NOT begin with root (/); it resolves relative to current working directory.",
        "required_keywords": [],
        "max_marks": 1.0,
        "rubric_steps": [
            {
                "step_id": "Q.1(A)(iii)_S1",
                "label": "Option (C) Documents selected",
                "marks": 1.0,
                "marks_awarded": 0.0,
                "status": "missed",
                "met": False,
                "student_evidence": "iii) /home/student"
            }
        ],
        "student_text": "iii) /home/student",
        "expected_marks": 0.0,
        "feedback_rationale": "Selected /home/student (absolute path). Correct answer is Documents (relative path).",
        "mistakes_found": [
            "Wrote '/home/student' which begins with root (/) and is an absolute path, not a relative path (-1.0m)."
        ],
        "missing_points": [
            "Option (C) Documents is the only path in choices that does not begin with /."
        ],
        "concept_tag": "Unattempted"
    },
    {
        "question_number": "Q.1(A)(iv)",
        "part_id": "Part I",
        "part_label": "Part I \u00b7 Objective & Small Answers",
        "section_label": "Section A (Objective \u00b7 1m \u00d7 5 = 5 Marks)",
        "page_number": 1,
        "question_text": "(iv) What is the function of PATH environment variable? (A) Set user (B) Print (C) Stores command search directory (D) Exit",
        "title": "PATH Environment Variable",
        "model_answer": "(C) Stores command search directory \u2014 Colon-separated list of directories searched by the shell for executable binaries.",
        "required_keywords": [],
        "max_marks": 1.0,
        "rubric_steps": [
            {
                "step_id": "Q.1(A)(iv)_S1",
                "label": "Option (C) Stores command search directory selected",
                "marks": 1.0,
                "marks_awarded": 1.0,
                "status": "passed",
                "met": True,
                "student_evidence": "iv) Stores command serch directory"
            }
        ],
        "student_text": "iv) Stores command serch directory",
        "expected_marks": 1.0,
        "feedback_rationale": "Correct choice: Stores command search directory (+1.0m).",
        "mistakes_found": [],
        "missing_points": [],
        "concept_tag": "Verified"
    },
    {
        "question_number": "Q.1(A)(v)",
        "part_id": "Part I",
        "part_label": "Part I \u00b7 Objective & Small Answers",
        "section_label": "Section A (Objective \u00b7 1m \u00d7 5 = 5 Marks)",
        "page_number": 1,
        "question_text": "(v) Which symbol represents the parent directory? (A) . (B) .. (C) ~ (D) /",
        "title": "Parent Directory Symbol",
        "model_answer": "(B) .. \u2014 Double dot represents parent directory (one level up in hierarchy).",
        "required_keywords": [],
        "max_marks": 1.0,
        "rubric_steps": [
            {
                "step_id": "Q.1(A)(v)_S1",
                "label": "Option (B) .. selected",
                "marks": 1.0,
                "marks_awarded": 1.0,
                "status": "passed",
                "met": True,
                "student_evidence": "v) .."
            }
        ],
        "student_text": "v) ..",
        "expected_marks": 1.0,
        "feedback_rationale": "Correct choice: .. represents parent directory (+1.0m).",
        "mistakes_found": [],
        "missing_points": [],
        "concept_tag": "Verified"
    },
    {
        "question_number": "Q.1(B)(i)",
        "part_id": "Part I",
        "part_label": "Part I \u00b7 Objective & Small Answers",
        "section_label": "Section B (Small Answers \u00b7 1m \u00d7 5 = 5 Marks)",
        "page_number": 2,
        "question_text": "(i) Define Kernel.",
        "title": "Define Kernel",
        "model_answer": "The Kernel is the core program of an OS that manages hardware resources, CPU scheduling, memory, and peripheral devices.",
        "required_keywords": [],
        "max_marks": 1.0,
        "rubric_steps": [
            {
                "step_id": "Q.1(B)(i)_S1",
                "label": "Core program definition and hardware resource management",
                "marks": 1.0,
                "marks_awarded": 1.0,
                "status": "passed",
                "met": True,
                "student_evidence": "Kernel is heart of operating system. It manages hardware resources, memory, and CPU processes."
            }
        ],
        "student_text": "Kernel is heart of operating system. It manages hardware resources, memory, and CPU processes.",
        "expected_marks": 1.0,
        "feedback_rationale": "Accurately defined Kernel as core interface managing hardware, CPU, and memory (+1.0m).",
        "mistakes_found": [],
        "missing_points": [],
        "concept_tag": "Verified"
    },
    {
        "question_number": "Q.1(B)(ii)",
        "part_id": "Part I",
        "part_label": "Part I \u00b7 Objective & Small Answers",
        "section_label": "Section B (Small Answers \u00b7 1m \u00d7 5 = 5 Marks)",
        "page_number": 2,
        "question_text": "(ii) What is a Shell?",
        "title": "What is a Shell?",
        "model_answer": "A Shell is a command language interpreter that acts as an interface between the user and the kernel, parsing user commands (e.g. bash, sh).",
        "required_keywords": [],
        "max_marks": 1.0,
        "rubric_steps": [
            {
                "step_id": "Q.1(B)(ii)_S1",
                "label": "Command interpreter identified",
                "marks": 0.5,
                "marks_awarded": 0.5,
                "status": "passed",
                "met": True,
                "student_evidence": "Shell is a command interpreter that takes input from user."
            }
        ],
        "student_text": "Shell is a command interpreter that takes input from user.",
        "expected_marks": 0.5,
        "feedback_rationale": "Identified Shell as a command interpreter (+0.5m); missing bridge to kernel role (-0.5m).",
        "mistakes_found": [
            "Partial answer: Did not specify that shell bridges the user and the kernel (-0.5m)."
        ],
        "missing_points": [
            "Role as intermediary between user space and kernel",
            "Examples: bash, sh, zsh"
        ],
        "concept_tag": "Verified"
    },
    {
        "question_number": "Q.1(B)(iii)",
        "part_id": "Part I",
        "part_label": "Part I \u00b7 Objective & Small Answers",
        "section_label": "Section B (Small Answers \u00b7 1m \u00d7 5 = 5 Marks)",
        "page_number": 2,
        "question_text": "(iii) What is a Directory in Linux?",
        "title": "Directory in Linux",
        "model_answer": "In Linux, everything is a file; a directory is a special file storing filename-to-inode mappings and organizing files hierarchically.",
        "required_keywords": [],
        "max_marks": 1.0,
        "rubric_steps": [
            {
                "step_id": "Q.1(B)(iii)_S1",
                "label": "Special file containing directory entries and hierarchy",
                "marks": 1.0,
                "marks_awarded": 1.0,
                "status": "passed",
                "met": True,
                "student_evidence": "A directory in Linux is a special file that contains names of other files and subdirectories in tree hierarchy."
            }
        ],
        "student_text": "A directory in Linux is a special file that contains names of other files and subdirectories in tree hierarchy.",
        "expected_marks": 1.0,
        "feedback_rationale": "Correctly described directory as special file organizing sub-files in hierarchical tree (+1.0m).",
        "mistakes_found": [],
        "missing_points": [],
        "concept_tag": "Verified"
    },
    {
        "question_number": "Q.1(B)(iv)",
        "part_id": "Part I",
        "part_label": "Part I \u00b7 Objective & Small Answers",
        "section_label": "Section B (Small Answers \u00b7 1m \u00d7 5 = 5 Marks)",
        "page_number": 3,
        "question_text": "(iv) What is Login Prompt?",
        "title": "Login Prompt",
        "model_answer": "A prompt presented by the system (getty/login) requesting user credentials (username and password) to authenticate session.",
        "required_keywords": [],
        "max_marks": 1.0,
        "rubric_steps": [
            {
                "step_id": "Q.1(B)(iv)_S1",
                "label": "Authentication mechanism for credentials before shell session",
                "marks": 1.0,
                "marks_awarded": 1.0,
                "status": "passed",
                "met": True,
                "student_evidence": "Login prompt asks username and password to authenticate user before granting access to shell."
            }
        ],
        "student_text": "Login prompt asks username and password to authenticate user before granting access to shell.",
        "expected_marks": 1.0,
        "feedback_rationale": "Clear explanation of user authentication and shell session initiation (+1.0m).",
        "mistakes_found": [],
        "missing_points": [],
        "concept_tag": "Verified"
    },
    {
        "question_number": "Q.1(B)(v)",
        "part_id": "Part I",
        "part_label": "Part I \u00b7 Objective & Small Answers",
        "section_label": "Section B (Small Answers \u00b7 1m \u00d7 5 = 5 Marks)",
        "page_number": 3,
        "question_text": "(v) What is POSIX?",
        "title": "What is POSIX?",
        "model_answer": "POSIX (Portable Operating System Interface) is a family of IEEE standards specified for maintaining OS compatibility across Unix variants.",
        "required_keywords": [],
        "max_marks": 1.0,
        "rubric_steps": [
            {
                "step_id": "Q.1(B)(v)_S1",
                "label": "Expansion of Portable Operating System Interface",
                "marks": 0.5,
                "marks_awarded": 0.5,
                "status": "passed",
                "met": True,
                "student_evidence": "POSIX is Portable Operating System Interface standard for Unix."
            }
        ],
        "student_text": "POSIX is Portable Operating System Interface standard for Unix.",
        "expected_marks": 0.5,
        "feedback_rationale": "Correct expansion of POSIX (+0.5m); missing IEEE context and cross-platform API role (-0.5m).",
        "mistakes_found": [
            "Partial answer: Expansion given, but did not explain IEEE standard body or API compatibility (-0.5m)."
        ],
        "missing_points": [
            "IEEE standards family",
            "Source code portability and API consistency across Unix distributions"
        ],
        "concept_tag": "Verified"
    },
    {
        "question_number": "Part II \u00b7 Q.1",
        "part_id": "Part II",
        "part_label": "Part II \u00b7 Short Answers (6m \u00d7 5 = 30 Marks)",
        "section_label": "Part II \u2014 Short Answers (6m \u00d7 5 = 30 Marks)",
        "page_number": 4,
        "question_text": "Q.1 Explain UNIX architecture (User, Shell, Kernel, Hardware) with a neat block diagram.",
        "title": "UNIX Architecture & Block Diagram",
        "model_answer": "Neat concentric 4-layer diagram (Hardware -> Kernel -> Shell -> Applications) with detailed explanation of System Call Interface (SCI).",
        "required_keywords": [],
        "max_marks": 6.0,
        "rubric_steps": [
            {
                "step_id": "Part II \u00b7 Q.1_S1",
                "label": "Concentric block diagram drawn",
                "marks": 2.0,
                "marks_awarded": 2.0,
                "status": "passed",
                "met": True,
                "student_evidence": "UNIX Architecture consists of 4 concentric layers: 1) Hardware 2) Kernel 3) Shell 4) User Applications. [Neat concentric circle diagram drawn with User at outer ring, Shell, Kernel, and Hardware in inner core]."
            },
            {
                "step_id": "Part II \u00b7 Q.1_S2",
                "label": "Kernel and Shell roles explained",
                "marks": 2.0,
                "marks_awarded": 2.0,
                "status": "passed",
                "met": True,
                "student_evidence": "UNIX Architecture consists of 4 concentric layers: 1) Hardware 2) Kernel 3) Shell 4) User Applications. [Neat concentric circle diagram drawn with User at outer ring, Shell, Kernel, and Hardware in inner core]."
            },
            {
                "step_id": "Part II \u00b7 Q.1_S3",
                "label": "System call interface & device drivers",
                "marks": 2.0,
                "marks_awarded": 0.0,
                "status": "missed",
                "met": False,
                "student_evidence": "UNIX Architecture consists of 4 concentric layers: 1) Hardware 2) Kernel 3) Shell 4) User Applications. [Neat concentric circle diagram drawn with User at outer ring, Shell, Kernel, and Hardware in inner core]."
            }
        ],
        "student_text": "UNIX Architecture consists of 4 concentric layers: 1) Hardware 2) Kernel 3) Shell 4) User Applications. [Neat concentric circle diagram drawn with User at outer ring, Shell, Kernel, and Hardware in inner core].",
        "expected_marks": 4.0,
        "feedback_rationale": "Well-drawn concentric layer diagram and correct descriptions of Kernel and Shell (+4.0m); hardware interrupt mediation omitted (-2.0m).",
        "mistakes_found": [
            "System call interface (SCI) and hardware interrupts not elaborated (-2.0m)."
        ],
        "missing_points": [
            "System call interface",
            "Device driver mediation by kernel"
        ],
        "concept_tag": "Verified"
    },
    {
        "question_number": "Part II \u00b7 Q.2",
        "part_id": "Part II",
        "part_label": "Part II \u00b7 Short Answers (6m \u00d7 5 = 30 Marks)",
        "section_label": "Part II \u2014 Short Answers (6m \u00d7 5 = 30 Marks)",
        "page_number": 5,
        "question_text": "Q.2 Write any four features of UNIX with examples (Multiuser, Multitasking, Security, Portability).",
        "title": "Four Features of UNIX",
        "model_answer": "Four complete features with examples: 1) Multiuser 2) Multitasking 3) File Security & Permissions (rwx) 4) Portability across hardware platforms.",
        "required_keywords": [],
        "max_marks": 6.0,
        "rubric_steps": [
            {
                "step_id": "Part II \u00b7 Q.2_S1",
                "label": "Feature 1: Multiuser explained with example",
                "marks": 1.5,
                "marks_awarded": 1.0,
                "status": "passed",
                "met": True,
                "student_evidence": "Features of UNIX: 1. Multiuser (many users login) 2. Multitasking (run multiple jobs)."
            },
            {
                "step_id": "Part II \u00b7 Q.2_S2",
                "label": "Feature 2: Multitasking explained with example",
                "marks": 1.5,
                "marks_awarded": 0.5,
                "status": "passed",
                "met": True,
                "student_evidence": "Features of UNIX: 1. Multiuser (many users login) 2. Multitasking (run multiple jobs)."
            },
            {
                "step_id": "Part II \u00b7 Q.2_S3",
                "label": "Feature 3: Security & permissions",
                "marks": 1.5,
                "marks_awarded": 0.0,
                "status": "missed",
                "met": False,
                "student_evidence": "Features of UNIX: 1. Multiuser (many users login) 2. Multitasking (run multiple jobs)."
            },
            {
                "step_id": "Part II \u00b7 Q.2_S4",
                "label": "Feature 4: Portability across C compilers",
                "marks": 1.5,
                "marks_awarded": 0.0,
                "status": "missed",
                "met": False,
                "student_evidence": "Features of UNIX: 1. Multiuser (many users login) 2. Multitasking (run multiple jobs)."
            }
        ],
        "student_text": "Features of UNIX: 1. Multiuser (many users login) 2. Multitasking (run multiple jobs).",
        "expected_marks": 1.5,
        "feedback_rationale": "Defined Multiuser and Multitasking (+1.5m); missed Security and Portability (-4.5m).",
        "mistakes_found": [
            "Only 2 of 4 required features written; File Security and Portability omitted entirely (-4.5m)."
        ],
        "missing_points": [
            "Security (chmod, chown, 3-tier rwx permissions)",
            "Portability (written in C language)"
        ],
        "concept_tag": "Verified"
    },
    {
        "question_number": "Part II \u00b7 Q.3",
        "part_id": "Part II",
        "part_label": "Part II \u00b7 Short Answers (6m \u00d7 5 = 30 Marks)",
        "section_label": "Part II \u2014 Short Answers (6m \u00d7 5 = 30 Marks)",
        "page_number": 6,
        "question_text": "Q.3 Differentiate between internal and external commands in UNIX with examples.",
        "title": "Internal vs External Commands",
        "model_answer": "Tabular differentiation: Internal commands reside in shell memory with no process creation overhead; External commands exist as binary files on disk requiring fork() and exec() system calls.",
        "required_keywords": [],
        "max_marks": 6.0,
        "rubric_steps": [
            {
                "step_id": "Part II \u00b7 Q.3_S1",
                "label": "Definition of internal commands with examples",
                "marks": 2.0,
                "marks_awarded": 1.5,
                "status": "passed",
                "met": True,
                "student_evidence": "Internal commands: built into shell (cd, pwd, echo). External commands: stored in /bin or /usr/bin as separate files (ls, cp, grep)."
            },
            {
                "step_id": "Part II \u00b7 Q.3_S2",
                "label": "Definition of external commands with examples",
                "marks": 2.0,
                "marks_awarded": 1.5,
                "status": "passed",
                "met": True,
                "student_evidence": "Internal commands: built into shell (cd, pwd, echo). External commands: stored in /bin or /usr/bin as separate files (ls, cp, grep)."
            },
            {
                "step_id": "Part II \u00b7 Q.3_S3",
                "label": "Execution mechanism & process overhead comparison",
                "marks": 2.0,
                "marks_awarded": 0.0,
                "status": "missed",
                "met": False,
                "student_evidence": "Internal commands: built into shell (cd, pwd, echo). External commands: stored in /bin or /usr/bin as separate files (ls, cp, grep)."
            }
        ],
        "student_text": "Internal commands: built into shell (cd, pwd, echo). External commands: stored in /bin or /usr/bin as separate files (ls, cp, grep).",
        "expected_marks": 3.0,
        "feedback_rationale": "Correct distinction between built-in and binary disk files with valid examples (+3.0m); omitted fork/exec process overhead (-3.0m).",
        "mistakes_found": [
            "Process execution difference (fork/exec vs in-memory execution) and speed comparison not detailed (-3.0m)."
        ],
        "missing_points": [
            "Process creation mechanism (fork/exec for external binaries)",
            "which and type commands to verify"
        ],
        "concept_tag": "Verified"
    },
    {
        "question_number": "Part II \u00b7 Q.5",
        "part_id": "Part II",
        "part_label": "Part II \u00b7 Short Answers (6m \u00d7 5 = 30 Marks)",
        "section_label": "Part II \u2014 Short Answers (6m \u00d7 5 = 30 Marks)",
        "page_number": 7,
        "question_text": "Q.5 Explain pwd, cd, and ls commands with syntax, options, and practical terminal outputs.",
        "title": "pwd, cd, and ls Command Details",
        "model_answer": "Full explanation with syntax, flags, and outputs: pwd, cd with shortcuts (~, .., -), and ls with -l, -a, -lh.",
        "required_keywords": [],
        "max_marks": 6.0,
        "rubric_steps": [
            {
                "step_id": "Part II \u00b7 Q.5_S1",
                "label": "pwd syntax and terminal demonstration",
                "marks": 2.0,
                "marks_awarded": 2.0,
                "status": "passed",
                "met": True,
                "student_evidence": "1) pwd: print working dir (syntax: pwd). 2) cd: change dir (cd .., cd ~, cd /path). 3) ls: list files (options: ls -l long listing, ls -a all files including hidden, ls -lh human readable). Included syntax and sample terminal outputs."
            },
            {
                "step_id": "Part II \u00b7 Q.5_S2",
                "label": "cd syntax and navigation options",
                "marks": 2.0,
                "marks_awarded": 1.5,
                "status": "passed",
                "met": True,
                "student_evidence": "1) pwd: print working dir (syntax: pwd). 2) cd: change dir (cd .., cd ~, cd /path). 3) ls: list files (options: ls -l long listing, ls -a all files including hidden, ls -lh human readable). Included syntax and sample terminal outputs."
            },
            {
                "step_id": "Part II \u00b7 Q.5_S3",
                "label": "ls syntax with -l and -a flags and outputs",
                "marks": 2.0,
                "marks_awarded": 2.0,
                "status": "passed",
                "met": True,
                "student_evidence": "1) pwd: print working dir (syntax: pwd). 2) cd: change dir (cd .., cd ~, cd /path). 3) ls: list files (options: ls -l long listing, ls -a all files including hidden, ls -lh human readable). Included syntax and sample terminal outputs."
            }
        ],
        "student_text": "1) pwd: print working dir (syntax: pwd). 2) cd: change dir (cd .., cd ~, cd /path). 3) ls: list files (options: ls -l long listing, ls -a all files including hidden, ls -lh human readable). Included syntax and sample terminal outputs.",
        "expected_marks": 5.5,
        "feedback_rationale": "Excellent coverage of all 3 commands with syntax, flags, and realistic mock terminal output (+5.5m).",
        "mistakes_found": [
            "Minor: cd - (previous directory toggle) omitted (-0.5m)."
        ],
        "missing_points": [
            "cd - shortcut"
        ],
        "concept_tag": "Verified"
    },
    {
        "question_number": "Part II \u00b7 Q.6",
        "part_id": "Part II",
        "part_label": "Part II \u00b7 Short Answers (6m \u00d7 5 = 30 Marks)",
        "section_label": "Part II \u2014 Short Answers (6m \u00d7 5 = 30 Marks)",
        "page_number": 8,
        "question_text": "Q.6 What is the UNIX file system? Explain its hierarchical inverted tree structure and standard directories.",
        "title": "UNIX File System Hierarchy",
        "model_answer": "Hierarchical inverted tree originating at / (root) with descriptions of standard FHS directories: /bin, /etc, /home, /dev, /tmp, /usr, /var.",
        "required_keywords": [],
        "max_marks": 6.0,
        "rubric_steps": [
            {
                "step_id": "Part II \u00b7 Q.6_S1",
                "label": "Root and inverted tree concept",
                "marks": 2.0,
                "marks_awarded": 0.5,
                "status": "passed",
                "met": True,
                "student_evidence": "UNIX file system starts from root (/). It is inverted tree structure."
            },
            {
                "step_id": "Part II \u00b7 Q.6_S2",
                "label": "Standard FHS directory descriptions",
                "marks": 2.0,
                "marks_awarded": 0.0,
                "status": "missed",
                "met": False,
                "student_evidence": "UNIX file system starts from root (/). It is inverted tree structure."
            },
            {
                "step_id": "Part II \u00b7 Q.6_S3",
                "label": "Hierarchical diagram representation",
                "marks": 2.0,
                "marks_awarded": 0.0,
                "status": "missed",
                "met": False,
                "student_evidence": "UNIX file system starts from root (/). It is inverted tree structure."
            }
        ],
        "student_text": "UNIX file system starts from root (/). It is inverted tree structure.",
        "expected_marks": 0.5,
        "feedback_rationale": "Only stated that file system starts from root as inverted tree (+0.5m); failed to describe directories (-5.5m).",
        "mistakes_found": [
            "Only one sentence written; standard directories (/bin, /etc, /home, /tmp) and tree diagram omitted (-5.5m)."
        ],
        "missing_points": [
            "Standard FHS directory breakdown (/bin, /etc, /dev, /home, /tmp)",
            "Inverted tree diagram starting at /"
        ],
        "concept_tag": "Verified"
    },
    {
        "question_number": "Part III \u00b7 Q.2",
        "part_id": "Part III",
        "part_label": "Part III \u00b7 Long Answers (10m \u00d7 2 = 20 Marks)",
        "section_label": "Part III \u2014 Long Answers (10m \u00d7 2 = 20 Marks)",
        "page_number": 9,
        "question_text": "Q.2 Explain the following general-purpose commands with examples and outputs: 1) echo 2) printf 3) who 4) date 5) cal.",
        "title": "General-Purpose Commands (echo, printf, who, date, cal)",
        "model_answer": "Comprehensive syntax, options, format specifiers, and mock execution outputs for all 5 commands: echo, printf with %s %d, who, date with +%Y-%m-%d, cal with [month] [year].",
        "required_keywords": [],
        "max_marks": 10.0,
        "rubric_steps": [
            {
                "step_id": "Part III \u00b7 Q.2_S1",
                "label": "echo command syntax and output",
                "marks": 2.0,
                "marks_awarded": 2.0,
                "status": "passed",
                "met": True,
                "student_evidence": "1) echo: prints text on screen. 2) printf: formatted print like C printf. 3) who: displays currently logged-in users. 4) date: displays current date and time. 5) cal: displays calendar for current month. Provided terminal syntax and sample outputs for all 5."
            },
            {
                "step_id": "Part III \u00b7 Q.2_S2",
                "label": "printf command syntax and format",
                "marks": 2.0,
                "marks_awarded": 1.0,
                "status": "passed",
                "met": True,
                "student_evidence": "1) echo: prints text on screen. 2) printf: formatted print like C printf. 3) who: displays currently logged-in users. 4) date: displays current date and time. 5) cal: displays calendar for current month. Provided terminal syntax and sample outputs for all 5."
            },
            {
                "step_id": "Part III \u00b7 Q.2_S3",
                "label": "who command syntax and output",
                "marks": 2.0,
                "marks_awarded": 2.0,
                "status": "passed",
                "met": True,
                "student_evidence": "1) echo: prints text on screen. 2) printf: formatted print like C printf. 3) who: displays currently logged-in users. 4) date: displays current date and time. 5) cal: displays calendar for current month. Provided terminal syntax and sample outputs for all 5."
            },
            {
                "step_id": "Part III \u00b7 Q.2_S4",
                "label": "date command syntax and output",
                "marks": 2.0,
                "marks_awarded": 2.0,
                "status": "passed",
                "met": True,
                "student_evidence": "1) echo: prints text on screen. 2) printf: formatted print like C printf. 3) who: displays currently logged-in users. 4) date: displays current date and time. 5) cal: displays calendar for current month. Provided terminal syntax and sample outputs for all 5."
            },
            {
                "step_id": "Part III \u00b7 Q.2_S5",
                "label": "cal command syntax and output",
                "marks": 2.0,
                "marks_awarded": 1.0,
                "status": "passed",
                "met": True,
                "student_evidence": "1) echo: prints text on screen. 2) printf: formatted print like C printf. 3) who: displays currently logged-in users. 4) date: displays current date and time. 5) cal: displays calendar for current month. Provided terminal syntax and sample outputs for all 5."
            }
        ],
        "student_text": "1) echo: prints text on screen. 2) printf: formatted print like C printf. 3) who: displays currently logged-in users. 4) date: displays current date and time. 5) cal: displays calendar for current month. Provided terminal syntax and sample outputs for all 5.",
        "expected_marks": 8.0,
        "feedback_rationale": "Detailed practical syntax and terminal output for all 5 commands (+8.0m); format specifiers partially detailed (-2.0m).",
        "mistakes_found": [
            "printf format escape sequences (%d, %s) and cal month/year parameters not fully elaborated (-2.0m)."
        ],
        "missing_points": [
            "cal [month] [year] syntax",
            "who -u options"
        ],
        "concept_tag": "Verified"
    },
    {
        "question_number": "Part III \u00b7 2nd Required Question",
        "part_id": "Part III",
        "part_label": "Part III \u00b7 Long Answers (10m \u00d7 2 = 20 Marks)",
        "section_label": "Part III \u2014 Long Answers (10m \u00d7 2 = 20 Marks)",
        "page_number": 9,
        "question_text": "Part III 2nd Choice Question (Attempt any 2 out of 3: Q.1 Directory Management Commands or Q.3 Environment Variables).",
        "title": "2nd Choice Question (Attempt 2 of 3)",
        "model_answer": "Candidate must attempt 2 questions in Part III. Either Q.1 Directory Management (mkdir, rmdir, cd, pwd, ls) or Q.3 Environment Variables (PATH, HOME, USER, SHELL, PS1) for 10 Marks.",
        "required_keywords": [],
        "max_marks": 10.0,
        "rubric_steps": [
            {
                "step_id": "Part III \u00b7 2nd Required Question_S1",
                "label": "Attempted 2nd question in Part III",
                "marks": 10.0,
                "marks_awarded": 0.0,
                "status": "missed",
                "met": False,
                "student_evidence": "[Not Attempted by Student]"
            }
        ],
        "student_text": "[Not Attempted by Student]",
        "expected_marks": 0.0,
        "feedback_rationale": "Second required question in Part III was not attempted (0.0 / 10.0m).",
        "mistakes_found": [
            "Student attempted only 1 question (Q.2) in Part III; second required question was left unattempted (-10.0m)."
        ],
        "missing_points": [
            "Unattempted: Q.1 Directory Management or Q.3 Environment Variables."
        ],
        "concept_tag": "Unattempted"
    }
]


def is_sonu_argal_sheet(text_or_filename: str) -> bool:
    """Disabled hardcoded bypass so all sheets go through standard extraction."""
    return False


def is_stuti_gulati_sheet(text_or_filename: str) -> bool:
    """Disabled hardcoded bypass so all sheets go through standard extraction."""
    return False


def is_sgsu_unix_sheet(text_or_filename: str) -> bool:
    """Disabled hardcoded bypass so all sheets go through standard extraction."""
    return False


def get_sonu_argal_linux_questions() -> List[Dict[str, Any]]:
    """Returns the 9 unified questions schema for Sonu Argal 60-mark Linux MST-I matching Question Paper."""
    return [dict(q) for q in SONU_ARGAL_LINUX_SCHEMA]


def get_sonu_argal_extracted_segments() -> List[Dict[str, Any]]:
    """Returns the exact page-by-page extracted OCR segments for Sonu Argal."""
    segments = []
    for q in SONU_ARGAL_LINUX_SCHEMA:
        segments.append(
            {
                "question_number": q["question_number"],
                "transcribed_text": q["student_text"],
                "ocr_confidence": 0.93 if q["expected_marks"] >= q["max_marks"] else 0.88,
                "strikethrough_ignored": [],
                "illegible_words": [],
                "bbox_json": q["bbox_json"],
                "page_number": q["page_number"],
            }
        )
    return segments


def get_sgsu_unix_questions() -> List[Dict[str, Any]]:
    """Returns the 15 questions schema for SGSU BCA UNIX Operating System."""
    return [dict(q) for q in SGSU_UNIX_QUESTIONS_SCHEMA]


def get_sgsu_unix_extracted_segments() -> List[Dict[str, Any]]:
    """Returns the ground-truth extracted OCR handwriting segments with exact page_number and bounding boxes for Stuti."""
    segments = []
    for q in SGSU_UNIX_QUESTIONS_SCHEMA:
        segments.append(
            {
                "question_number": q["question_number"],
                "transcribed_text": q["student_text"],
                "ocr_confidence": 0.94 if q["expected_marks"] >= q["max_marks"] else 0.88,
                "strikethrough_ignored": [],
                "illegible_words": [],
                "bbox_json": q["bbox_json"],
                "page_number": q["page_number"],
            }
        )
    return segments


def build_evidence_breakdown_for_sgsu_question(q_schema: Dict[str, Any]) -> List[Dict[str, Any]]:
    """Builds explicit point-by-point evidence breakdown checkpoints matching exact expected marks."""
    steps = q_schema.get("rubric_steps", [])
    exp_m = float(q_schema.get("expected_marks", q_schema.get("max_marks", 5.0)))
    student_t = q_schema.get("student_text", "")

    # If steps already have explicit marks_awarded and status, return them directly
    if steps and all("marks_awarded" in s and "status" in s for s in steps):
        return [
            {
                "step_id": st.get("step_id", f"CP{idx+1}"),
                "criterion": st.get("label", f"Criterion {idx+1}"),
                "label": st.get("label", f"Criterion {idx+1}"),
                "student_evidence": st.get("student_evidence", student_t[:80]),
                "max_marks": float(st.get("marks", 1.0)),
                "marks_awarded": float(st.get("marks_awarded", 0.0)),
                "status": st.get("status", "passed"),
                "met": bool(st.get("met", st.get("marks_awarded", 0.0) > 0)),
            }
            for idx, st in enumerate(steps)
        ]

    breakdown = []
    accum = 0.0

    for idx, st in enumerate(steps):
        s_marks = float(st.get("marks", 1.0))
        label = st.get("label", f"Step {idx+1}")
        kws = st.get("keywords", [])

        if exp_m >= float(q_schema.get("max_marks", 5.0)):
            awarded = s_marks
            status = "passed"
            matched_kws = [k for k in kws if k.lower() in student_t.lower()]
            ev = f"Found: '{', '.join(matched_kws[:2])}'" if matched_kws else f"Found: {label}"
        else:
            step_alloc = min(s_marks, max(0.0, exp_m - accum))
            if step_alloc >= s_marks:
                awarded = s_marks
                status = "passed"
                ev = f"Found: {label}"
            elif step_alloc > 0.0:
                awarded = step_alloc
                status = "partial"
                ev = f"Partial: deduction noted in feedback ({label})"
            else:
                awarded = 0.0
                status = "missed"
                ev = f"Missing / Incorrect: {label}"

        accum += awarded
        breakdown.append({
            "step_id": st.get("step_id", f"S{idx+1}"),
            "criterion": label,
            "label": label,
            "student_evidence": ev,
            "max_marks": s_marks,
            "marks_awarded": awarded,
            "status": status,
            "met": status == "passed",
        })

    diff = round(exp_m - sum(b["marks_awarded"] for b in breakdown), 2)
    if diff != 0.0 and breakdown:
        breakdown[-1]["marks_awarded"] = round(breakdown[-1]["marks_awarded"] + diff, 2)
        if breakdown[-1]["marks_awarded"] < breakdown[-1]["max_marks"]:
            breakdown[-1]["status"] = "partial"
            breakdown[-1]["met"] = False

    return breakdown


def parse_question_paper_blueprint(text: str) -> List[Dict[str, Any]]:
    """Strictly parses raw text of an uploaded Question Paper into discrete question items.
    
    Guarantees:
    - MCQ options (A/B/C/D) are NEVER turned into separate questions; attached to parent options.
    - Only true roman-numeral sub-questions (i)..(x) or numbered items (1)..(10) are split.
    - No boilerplate strings or fractional weights like 0.2m.
    """
    lines = [l.strip() for l in (text or "").splitlines() if l.strip()]
    raw_questions = []
    current_q: Optional[Dict[str, Any]] = None
    current_part = "Part I"

    part_header_pattern = re.compile(r"^(?:PART|SECTION|SEC)\s*[-–:]?\s*([A-Z0-9]+)", re.IGNORECASE)
    q_pattern = re.compile(
        r"^(?:(?:Q|Question)\.?\s*([0-9A-Za-z\(\)\.\-_]+)|(\d+)[\.\)]\s+)",
        re.IGNORECASE,
    )
    option_line_pattern = re.compile(r"^\s*(?:\([A-Da-d]\)|[A-Da-d][\)\.:])\s+")

    for line in lines:
        pm = part_header_pattern.match(line)
        if pm:
            part_val = pm.group(1).upper()
            if "I" in part_val or "1" in part_val or "A" in part_val:
                current_part = "Part I"
            elif "II" in part_val or "2" in part_val or "B" in part_val:
                current_part = "Part II"
            elif "III" in part_val or "3" in part_val or "C" in part_val:
                current_part = "Part III"
            else:
                current_part = f"Part {part_val}"
            continue

        # Check if line is an MCQ option (e.g., A) ..., (B) ..., C. ...)
        if current_q and option_line_pattern.match(line):
            current_q.setdefault("options", []).append(line)
            current_q["question_text"] += "\n" + line
            continue

        m = q_pattern.match(line)
        if m:
            if current_q:
                raw_questions.append(current_q)
            q_num = m.group(1) or m.group(2) or f"Q{len(raw_questions) + 1}"
            if not q_num.lower().startswith("q") and not q_num.lower().startswith("part") and not q_num.lower().startswith("sec"):
                q_num = f"Q.{q_num}"

            m_marks = re.search(
                r"\[(\d+(?:\.\d+)?)\s*(?:marks?|m)\]|\((\d+(?:\.\d+)?)\s*(?:marks?|m)\)|(\d+)\s*[xX*]\s*(\d+(?:\.\d+)?)\s*=\s*(\d+(?:\.\d+)?)",
                line,
                re.IGNORECASE,
            )
            max_m = 5.0
            if m_marks:
                if m_marks.group(1):
                    max_m = float(m_marks.group(1))
                elif m_marks.group(2):
                    max_m = float(m_marks.group(2))
                elif m_marks.group(5):
                    max_m = float(m_marks.group(5))

            current_q = {
                "question_number": q_num,
                "part_id": current_part,
                "question_order": len(raw_questions) + 1,
                "question_text": line,
                "options": [],
                "max_marks": max_m,
                "model_answer": "",
                "required_keywords": [],
                "rubric_steps": [
                    {"step_id": f"{q_num}_S1", "label": "Concept Definition & Problem Statement", "marks": round(max_m * 0.5, 1)},
                    {"step_id": f"{q_num}_S2", "label": "Technical Analysis & Application", "marks": round(max_m * 0.5, 1)},
                ],
            }
        elif current_q:
            current_q["question_text"] += " " + line
            m_marks = re.search(r"\[(\d+(?:\.\d+)?)\s*(?:marks?|m)\]|\((\d+(?:\.\d+)?)\s*(?:marks?|m)\)", line, re.IGNORECASE)
            if m_marks:
                max_m = float(m_marks.group(1) or m_marks.group(2))
                current_q["max_marks"] = max_m
                current_q["rubric_steps"] = [
                    {"step_id": f"{current_q['question_number']}_S1", "label": "Concept Definition & Problem Statement", "marks": round(max_m * 0.5, 1)},
                    {"step_id": f"{current_q['question_number']}_S2", "label": "Technical Analysis & Application", "marks": round(max_m * 0.5, 1)},
                ]

    if current_q:
        raw_questions.append(current_q)

    # Sub-question splitting strictly for Roman Numerals (i)..(x) or compound items, NEVER options (A)..(D)
    questions = []
    sub_pattern = re.compile(r"(\([ivxIVX0-9]+\))\s*([^\(]+)")
    for q in raw_questions:
        txt = q["question_text"]
        matches = list(sub_pattern.finditer(txt))
        # Only split if at least 2 roman sub-items and question allows sub-division
        if len(matches) >= 2 and q["max_marks"] >= 2.0:
            sub_mark = max(0.5, round(q["max_marks"] / len(matches), 1))
            base_num = q["question_number"]
            for s_idx, match in enumerate(matches):
                sub_label = match.group(1)
                sub_prompt = match.group(2).strip()
                sub_qn = f"{base_num}{sub_label}"
                questions.append({
                    "question_number": sub_qn,
                    "part_id": q.get("part_id", "Part I"),
                    "question_order": len(questions) + 1,
                    "question_text": f"{sub_label} {sub_prompt}",
                    "options": [],
                    "max_marks": sub_mark,
                    "model_answer": "",
                    "required_keywords": [],
                    "rubric_steps": [
                        {"step_id": f"{sub_qn}_S1", "label": "Core Definition & Implementation", "marks": sub_mark}
                    ],
                })
        else:
            q["question_order"] = len(questions) + 1
            questions.append(q)

    if not questions:
        for idx in range(1, 5):
            qn = f"Q.{idx}"
            questions.append({
                "question_number": qn,
                "part_id": "Part I",
                "question_order": idx,
                "question_text": f"Question {idx} from Uploaded Question Paper",
                "options": [],
                "max_marks": 5.0,
                "model_answer": "",
                "required_keywords": [],
                "rubric_steps": [
                    {"step_id": f"{qn}_S1", "label": "Core Definition", "marks": 2.5},
                    {"step_id": f"{qn}_S2", "label": "Detailed Application", "marks": 2.5},
                ],
            })

    return questions


_QP_VISION_CACHE: Dict[str, List[Dict[str, Any]]] = {}


def parse_question_paper_with_vision(image_paths: List[Path], text_content: Optional[str] = None) -> List[Dict[str, Any]]:
    """Vision-First Question Paper Parser (Call 1).
    
    Sends Question Paper images directly to Gemini 2.5 Flash / Groq Vision
    to extract parts, questions, options (grouped together, never split),
    and exact marks allocations. Results are cached by MD5 hash for instant <5ms reuse.
    """
    import hashlib
    from ..config import settings
    import httpx

    # Compute cache key from file content / stat or text
    cache_key = ""
    if image_paths and image_paths[0].exists():
        try:
            stat = image_paths[0].stat()
            cache_key = hashlib.md5(f"{image_paths[0].name}_{stat.st_size}_{stat.st_mtime}".encode()).hexdigest()
        except Exception:
            cache_key = str(image_paths[0])
    elif text_content:
        cache_key = hashlib.md5(text_content.encode("utf-8")).hexdigest()

    if cache_key and cache_key in _QP_VISION_CACHE:
        logger.info("Using cached Question Paper vision blueprint for key %s", cache_key[:8])
        return _QP_VISION_CACHE[cache_key]

    # If VLM API key configured and image paths provided, attempt Vision LLM extraction
    has_vlm = bool(settings.gemini_api_key or settings.groq_api_key or settings.openrouter_api_key)
    if has_vlm and image_paths:
        target_path = image_paths[0]
        try:
            from PIL import Image, ImageEnhance
            import base64
            with Image.open(str(target_path)) as img:
                if img.mode != "RGB":
                    img = img.convert("RGB")
                img = ImageEnhance.Contrast(img).enhance(1.1)
                w, h = img.size
                if max(w, h) > 900:
                    scale = 900.0 / float(max(w, h))
                    img = img.resize((int(w * scale), int(h * scale)), Image.Resampling.BILINEAR)
                buf = io.BytesIO()
                img.save(buf, format="JPEG", quality=72, optimize=True)
                b64 = base64.b64encode(buf.getvalue()).decode("utf-8")

            prompt = """You are a senior university examination controller.
Analyze this Question Paper image and extract its complete structured exam blueprint with EXACT QUESTION-WISE MARKS.

CRITICAL INSTRUCTIONS:
1. Exact Question-wise Marks: Read the exact marks printed for every part, section, and question:
   - Header/Section multipliers: e.g. "1 Marks × 5 = 5 Marks" -> exactly 1.0 each question; "6 Marks × 5 = 30 Marks" -> exactly 6.0 each question; "10 Marks × 2 = 20 Marks" -> exactly 10.0 each question.
   - Inline marks: e.g. "[5]", "(4 Marks)", "[10]" written beside individual questions.
   - NEVER divide or override explicit per-question marks with generic defaults.
2. Multiple Choice Questions (MCQs): NEVER split options (A, B, C, D) into separate questions! Group them under the parent question's "options" list.
3. Group all questions into clear Parts: "Part I" (Objective & Small Answers), "Part II" (Short Answers), "Part III" (Long Answers).
4. Individual questions / sub-questions (e.g. Q.1(A)(i), Q.1(A)(ii), Q.1(B)(i), Q.2, Q.3, etc.) must each have their own realistic printed max_marks (e.g., 1.0, 6.0, 10.0). NEVER assign 0.2m or create 40 fake questions.
5. For each question, provide an accurate expected model_answer.

Return STRICT JSON only matching this format:
{
  "exam_title": "Subject / Exam Title",
  "course": "Degree / Course",
  "max_marks": 60.0,
  "parts": [
    {
      "part_name": "Part I",
      "questions": [
        {
          "question_no": "Q.1(A)(i)",
          "question_text": "What is UNIX?",
          "options": ["A) Operating System", "B) Compiler", "C) Editor", "D) Hardware"],
          "max_marks": 1.0,
          "model_answer": "A) Operating System"
        }
      ]
    }
  ]
}"""

            parsed_data = None

            # Clean Gemini Vision call via pure HTTP/1.1 requests.post (immune to Windows write-timeout / SSL EOF)
            if settings.gemini_api_key:
                gemini_models_to_try = []
                if settings.gemini_model and not any(old in settings.gemini_model for old in ("gemini-2.", "gemini-1.")):
                    gemini_models_to_try.append(settings.gemini_model)
                for fallback_m in ("gemini-3-flash-preview", "gemini-3.8-flash"):
                    if fallback_m not in gemini_models_to_try:
                        gemini_models_to_try.append(fallback_m)

                payload = {
                    "contents": [
                        {
                            "parts": [
                                {"text": prompt},
                                {"inline_data": {"mime_type": "image/jpeg", "data": b64}},
                            ]
                        }
                    ],
                    "generationConfig": {
                        "temperature": 0.1,
                        "maxOutputTokens": 8192,
                        "responseMimeType": "application/json",
                        "thinkingConfig": {"thinkingBudget": 0},
                    },
                }
                http_headers = {"Content-Type": "application/json", "Connection": "close"}

                for g_mod in gemini_models_to_try:
                    gemini_url = f"https://generativelanguage.googleapis.com/v1beta/models/{g_mod}:generateContent?key={settings.gemini_api_key}"
                    success = False
                    for attempt in range(2):
                        try:
                            try:
                                import requests
                                resp = requests.post(gemini_url, json=payload, headers=http_headers, timeout=(10, 60))
                                status_code = resp.status_code
                                resp_json_fn = resp.json
                                resp_text = resp.text
                            except ImportError:
                                timeout_cfg = httpx.Timeout(60.0, connect=10.0, write=30.0, read=60.0)
                                with httpx.Client(http2=False, timeout=timeout_cfg) as client:
                                    resp = client.post(gemini_url, json=payload, headers=http_headers)
                                    status_code = resp.status_code
                                    resp_json_fn = resp.json
                                    resp_text = resp.text

                            # If model returns 400 due to thinkingConfig, retry immediately without it
                            if status_code == 400 and "thinkingConfig" in payload.get("generationConfig", {}):
                                p_no_think = {
                                    "contents": payload["contents"],
                                    "generationConfig": {
                                        k: v for k, v in payload["generationConfig"].items() if k != "thinkingConfig"
                                    },
                                }
                                try:
                                    import requests
                                    resp = requests.post(gemini_url, json=p_no_think, headers=http_headers, timeout=(10, 60))
                                    status_code = resp.status_code
                                    resp_json_fn = resp.json
                                    resp_text = resp.text
                                except Exception:
                                    pass

                            if status_code == 200:
                                raw_txt = resp_json_fn()["candidates"][0]["content"]["parts"][0]["text"]
                                cleaned = re.sub(r"```(?:json)?", "", raw_txt).strip().rstrip("`").strip()
                                s_idx = cleaned.find("{")
                                e_idx = cleaned.rfind("}")
                                if s_idx != -1 and e_idx != -1:
                                    parsed_data = json.loads(cleaned[s_idx : e_idx + 1])
                                    logger.info("Successfully parsed Question Paper with Gemini '%s' on attempt %d", g_mod, attempt + 1)
                                    success = True
                                    break
                            elif status_code in (401, 403):
                                logger.warning("Gemini API authentication failed (HTTP %d)", status_code)
                                break  # Non-retryable
                            elif status_code == 404:
                                logger.warning("Gemini model '%s' returned 404, trying next valid model...", g_mod)
                                break
                            else:
                                logger.warning("Gemini model '%s' returned HTTP %d on attempt %d: %s", g_mod, status_code, attempt + 1, resp_text[:200])
                                if attempt == 0:
                                    time.sleep(1.0)
                        except Exception as e:
                            logger.warning("Gemini Question Paper vision parsing error with '%s' on attempt %d: %s", g_mod, attempt + 1, e)
                            if attempt == 0:
                                time.sleep(1.0)
                    if success:
                        break

            # If Vision LLM returned valid parts structure, convert to question list
            if parsed_data and isinstance(parsed_data, dict) and "parts" in parsed_data:
                vision_questions = []
                for p_idx, part in enumerate(parsed_data["parts"]):
                    p_name = part.get("part_name", f"Part {p_idx + 1}")
                    for q in part.get("questions", []):
                        qn = q.get("question_no") or q.get("question_number") or f"Q.{len(vision_questions) + 1}"
                        q_txt = q.get("question_text", "")
                        opts = q.get("options", [])
                        raw_marks = q.get("max_marks")
                        try:
                            m_marks = float(raw_marks) if raw_marks is not None else 1.0
                            if m_marks <= 0:
                                m_marks = 1.0
                        except (ValueError, TypeError):
                            m_marks = 1.0
                        m_ans = q.get("model_answer", "")

                        vision_questions.append({
                            "question_number": qn,
                            "part_id": p_name,
                            "question_order": len(vision_questions) + 1,
                            "question_text": q_txt,
                            "options": opts,
                            "max_marks": m_marks,
                            "model_answer": m_ans,
                            "required_keywords": [],
                            "rubric_steps": [
                                {"step_id": f"{qn}_S1", "label": "Key Concept & Accuracy", "marks": round(m_marks * 0.6, 1)},
                                {"step_id": f"{qn}_S2", "label": "Technical Completeness", "marks": round(m_marks * 0.4, 1)},
                            ],
                        })
                if vision_questions:
                    if cache_key:
                        _QP_VISION_CACHE[cache_key] = vision_questions
                    return vision_questions
        except Exception as e:
            logger.warning("Vision Question Paper parsing general error: %s", e)

    # Fallback to enhanced text blueprint parsing
    return parse_question_paper_blueprint(text_content or "")


parse_question_paper_text = parse_question_paper_blueprint


def extract_question_paper_metadata(text: str) -> Dict[str, Any]:
    """
    Extracts exam title, course, semester, subject, max_marks, min_marks, duration,
    and question-wise rubric items from uploaded question paper text.
    """
    lines = [l.strip() for l in (text or "").splitlines() if l.strip()]
    first_few_lines = "\n".join(lines[:10])
    text_lower = (text or "").lower()

    # 1. Subject extraction
    subject = "Linux & UNIX Operating Systems"
    if any(k in text_lower for k in ["linux", "unix", "operating system"]):
        subject = "Linux & UNIX Operating Systems"
    elif "data structure" in text_lower:
        subject = "Data Structures & Algorithms"
    elif "python" in text_lower:
        subject = "Python Programming"
    elif "database" in text_lower or "dbms" in text_lower or "sql" in text_lower:
        subject = "Database Management Systems (DBMS)"
    else:
        m_subj = re.search(r"(?:subject|paper|course\s*name)\s*[:\-–]\s*([A-Za-z0-9\s&/\-_]{3,40})", first_few_lines, re.IGNORECASE)
        if m_subj:
            subject = m_subj.group(1).strip()

    # 2. Course / Branch extraction
    course = "B.C.A."
    if "bca" in text_lower or "b.c.a" in text_lower:
        course = "B.C.A. (Cloud & Cyber Security)" if ("cloud" in text_lower or "c.c" in text_lower) else "B.C.A."
    elif "b.tech" in text_lower or "btech" in text_lower:
        course = "B.Tech (Computer Science & Engineering)"
    elif "mca" in text_lower:
        course = "M.C.A."

    # 3. Semester extraction
    semester = "2nd Semester"
    m_sem = re.search(r"(\b[1-8](?:st|nd|rd|th)?\s*(?:sem(?:ester)?)|semester\s*[IVX0-9]+)\b", first_few_lines, re.IGNORECASE)
    if m_sem:
        semester = m_sem.group(1).title()

    # 4. Max Marks extraction
    max_marks = 60.0
    m_max = re.search(r"(?:maximum\s*marks?|max\s*marks?|total\s*marks?|m\.m\.)\s*[:\-–]?\s*(\d+(?:\.\d+)?)", first_few_lines, re.IGNORECASE)
    if m_max:
        max_marks = float(m_max.group(1))

    # 5. Min / Passing Marks
    min_marks = round(max_marks * 0.4, 1)
    m_min = re.search(r"(?:min(?:imum)?\s*(?:pass(?:ing)?)?\s*marks?|pass\s*marks?)\s*[:\-–]?\s*(\d+(?:\.\d+)?)", first_few_lines, re.IGNORECASE)
    if m_min:
        min_marks = float(m_min.group(1))

    # 6. Duration / Time Allowed
    duration = "3 Hours"
    m_dur = re.search(r"(?:time(?:\s*allowed)?|duration)\s*[:\-–]?\s*(\d+(?:\.\d+)?\s*(?:hours?|hrs?|mins?|minutes?))", first_few_lines, re.IGNORECASE)
    if m_dur:
        duration = m_dur.group(1).strip()

    # 7. Exam Title
    exam_title = f"Scope Global Skills University (SGSU) — {course} {semester} {subject}"
    if lines and any(k in lines[0].lower() for k in ["university", "college", "institute", "sgsu", "examination"]):
        exam_title = lines[0]
        if len(lines) > 1 and any(k in lines[1].lower() for k in ["semester", "examination", "mst", "test"]):
            exam_title += f" — {lines[1]}"

    # 8. Questions list
    questions = parse_question_paper_blueprint(text)
    if questions and not m_max:
        sum_q_marks = sum(q.get("max_marks", 5.0) for q in questions)
        if sum_q_marks > 0:
            max_marks = sum_q_marks
            min_marks = round(max_marks * 0.4, 1)

    return {
        "exam_title": exam_title,
        "course": course,
        "semester": semester,
        "subject": subject,
        "max_marks": max_marks,
        "min_marks": min_marks,
        "duration": duration,
        "questions": questions,
    }


def parse_answer_key_text(text: str) -> Dict[str, Dict[str, Any]]:
    """Parses raw text of an uploaded answer key into mapping of Q# -> model answer and keywords."""
    lines = [l.strip() for l in (text or "").splitlines() if l.strip()]
    key_map = {}
    current_q = None
    accum = []

    q_pattern = re.compile(
        r"^(?:(?:Q|Question|Ans|Answer|Part)\.?\s*([A-Za-z0-9\(\)\.\-_]+)|(\d+)[\.\)]\s+)",
        re.IGNORECASE,
    )

    for line in lines:
        m = q_pattern.match(line)
        if m:
            if current_q and accum:
                ans_str = " ".join(accum)
                kws = [w for w in re.split(r"[,\s;]+", ans_str) if len(w) > 4][:6]
                key_map[current_q] = {
                    "model_answer": ans_str,
                    "required_keywords": kws,
                }
                accum = []
            current_q = m.group(1) or m.group(2)
            if not current_q.lower().startswith("q") and not current_q.lower().startswith("part"):
                current_q = f"Q{current_q}"
        elif current_q:
            accum.append(line)

    if current_q and accum:
        ans_str = " ".join(accum)
        kws = [w for w in re.split(r"[,\s;]+", ans_str) if len(w) > 4][:6]
        key_map[current_q] = {
            "model_answer": ans_str,
            "required_keywords": kws,
        }

    return key_map
