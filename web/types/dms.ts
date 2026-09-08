export interface DocRecord {
  id: string;
  title: string;
  category: 'SOP' | 'License' | 'Report' | 'Compliance' | 'Policy' | 'Other';
  type: 'PDF' | 'DOCX' | 'JPG' | 'XLSX' | 'PPTX' | 'TXT' | string;
  size: string;
  version: string;
  uploadDate: string;
  expiryDate?: string;
  author: string;
  status: 'Active' | 'Draft' | 'Expiring' | 'Archived' | 'Deleted' | 'Pending';
  fileUrl?: string;
  fileName?: string;
  notes?: string;
}

export interface DocumentRecord extends DocRecord {
  tags?: string[];
  keywords?: string[];
  department?: string;
  approvers?: string[];
  approvedBy?: string[];
  approvalDate?: string;
  fileSize?: number;
  pageCount?: number;
  documentOwner?: string;
  stakeholders?: string[];
  securityLevel?: 'Public' | 'Confidential' | 'Internal' | 'Restricted';
  createdAt?: string;
  lastModified?: string;
  lastModifiedBy?: string;
  viewCount?: number;
  downloadCount?: number;
  relatedDocuments?: string[];
  workflowStatus?: 'Draft' | 'In Review' | 'Approved' | 'Rejected' | 'Published';
  retentionPeriod?: number;
  classification?: 'Regulatory' | 'Operational' | 'Financial' | 'HR' | 'Technical';
}

export interface DocumentVersion {
  id: string;
  documentId: string;
  title?: string;
  version: string;
  fileUrl: string;
  fileSize: number;
  uploadedBy: string;
  uploadDate: string;
  changeLog: string;
  approvedBy: string;
  approvalDate: string;
  status: 'Current' | 'Previous' | 'Archived' | string;
}

export interface WorkflowComment {
  id: string;
  workflowId: string;
  author: string;
  comment: string;
  timestamp: string;
  action: 'Comment' | 'Approve' | 'Reject' | 'Request Changes';
}

export interface DocumentWorkflow {
  id: string;
  documentId: string;
  documentTitle: string;
  currentStep: 'Draft' | 'Review' | 'Approval' | 'Published';
  assignedTo: string;
  dueDate: string;
  comments: WorkflowComment[];
  status: 'Pending' | 'In Progress' | 'Completed' | 'Rejected';
  createdAt: string;
  updatedAt: string;
}

export interface DocumentAuditTrail {
  id: string;
  documentId: string;
  action: 'Created' | 'Modified' | 'Viewed' | 'Downloaded' | 'Deleted' | 'Approved' | 'Rejected';
  userId: string;
  userName: string;
  timestamp: string;
  ipAddress: string;
  details: string;
}

export interface DocumentStats {
  total: number;
  active: number;
  expiring: number;
  expiring15Days?: number;
  draft: number;
  pending: number;
  storageBytes: number;
  storageUsed: string;
}

export interface ExpiryNotificationItem {
  id: string;
  title: string;
  category: string;
  currentVersion: string;
  expiryDate: string;
  daysRemaining: number;
  isExpired: boolean;
  isUrgent: boolean;
  fileUrl?: string;
  authorName: string;
}
