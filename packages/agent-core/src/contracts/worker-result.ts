export interface ArtifactToRegister {
  artifactType: string;
  pathOrUrl: string;
  metadata?: Record<string, unknown>;
}

export interface WorkerError {
  message: string;
  stack?: string;
  code?: string;
}

export interface ApprovalRequest {
  actionType: string;
  requestedBy: string;
  notes?: string;
  expiresInMinutes?: number;
}

export interface WorkerResult {
  status: "completed" | "failed" | "needs_approval";
  summary: string;
  outputPayload: Record<string, unknown>;
  artifacts?: ArtifactToRegister[];
  error?: WorkerError;
  tokensUsed?: number;
  costUsd?: number;
  requestApproval?: ApprovalRequest;
}
