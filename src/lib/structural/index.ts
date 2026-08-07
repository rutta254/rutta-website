import { analyzeBeam, BeamAnalysisRequest, BeamAnalysisResult } from './beam';
import { analyzeColumn, ColumnAnalysisRequest, ColumnAnalysisResult } from './column';

export type StructuralAnalysisRequest = BeamAnalysisRequest | ColumnAnalysisRequest | { element_type: 'truss' } | { element_type: 'plate' };

export type StructuralAnalysisResponse = BeamAnalysisResult | ColumnAnalysisResult | { element_type: 'truss'; message: string } | { element_type: 'plate'; message: string };

export function analyzeStructure(body: unknown): StructuralAnalysisResponse {
  if (typeof body !== 'object' || body === null || !('element_type' in body)) {
    throw new Error('Invalid request body: missing element_type');
  }

  const request = body as StructuralAnalysisRequest;

  if (request.element_type === 'beam') {
    return analyzeBeam(request as BeamAnalysisRequest);
  }

  if (request.element_type === 'column') {
    return analyzeColumn(request as ColumnAnalysisRequest);
  }

  if (request.element_type === 'truss') {
    return { element_type: 'truss', message: 'Truss analysis support coming soon.' };
  }

  return { element_type: 'plate', message: 'Plate analysis support coming soon.' };
}
