import axios from 'axios';
import { apiUrl } from '../config';

export const apiClient = axios.create({
  baseURL: apiUrl('/api'),
  timeout: 25000,
});

export async function fetchExams() {
  const { data } = await apiClient.get('/exams');
  return data;
}

export async function fetchSubmissions(examId) {
  const { data } = await apiClient.get('/submissions', { params: { exam_id: examId } });
  return data;
}

export async function verifyAnswer(evaluationId, payload) {
  const { data } = await apiClient.put(`/verify/${evaluationId}`, payload);
  return data;
}

export async function approveAllAnswers(submissionId) {
  const { data } = await apiClient.post(`/submissions/${submissionId}/approve-all`);
  return data;
}

export async function updateRubricRetroactive(examId, payload) {
  const { data } = await apiClient.put(`/exams/${examId}/rubric-retroactive`, payload);
  return data;
}

export async function updateCredentials(payload) {
  const { data } = await apiClient.post('/settings/credentials', payload);
  return data;
}
