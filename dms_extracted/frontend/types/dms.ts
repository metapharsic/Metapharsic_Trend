export interface DocRecord {
  id: string;
  title: string;
  category: 'SOP' | 'License' | 'Report' | 'Compliance' | 'Policy' | 'Other';
  type: 'PDF' | 'DOCX' | 'JPG' | 'XLSX' | 'PPTX' | 'TXT';
  size: string;
  version: string;
  uploadDate: string;
  expiryDate?: string;
  author: string;
  status: 'Active' | 'Draft' | 'Expiring' | 'Archived' | 'Deleted' | 'Pending';
}

export interface Document extends DocRecord {
  tags: string[];
  keywords: string[];
  department: string;
  approvers: string[];
  approvedBy: string[];
  approvalDate: string;
  fileSize: number;
  pageCount: number;
  documentOwner: string;
  stakeholders: string[];
  securityLevel: 'Public' | 'Confidential' | 'Internal' | 'Restricted';
  createdAt: string;
  lastModified: string;
  lastModifiedBy: string;
  viewCount: number;
  downloadCount: number;
  relatedDocuments: string[];
  workflowStatus: 'Draft' | 'In Review' | 'Approved' | 'Rejected' | 'Published';
  retentionPeriod: number;
  classification: 'Regulatory' | 'Operational' | 'Financial' | 'HR' | 'Technical';
}

export interface DocumentVersion {
  id: string;
  documentId: string;
  version: string;
  title: string;
  fileUrl: string;
  fileSize: number;
  uploadedBy: string;
  uploadDate: string;
  changeLog: string;
  approvedBy: string;
  approvalDate: string;
  status: 'Current' | 'Previous' | 'Archived';
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

export interface DocumentTag {
  id: string;
  name: string;
  color: string;
  category: 'Department' | 'Project' | 'Compliance' | 'Product' | 'Process';
  usageCount: number;
}
