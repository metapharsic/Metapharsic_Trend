"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { 
  FileText, Folder, Upload, Search, Filter, Download, Trash2, Eye, File, 
  Clock, AlertCircle, CheckCircle, Plus, X, FileCheck, HardDrive, History, 
  Workflow, BarChart3, FileSpreadsheet, Tag, Shield, RefreshCw 
} from 'lucide-react';
import { DocRecord, DocumentVersion, DocumentWorkflow, DocumentAuditTrail, DocumentStats, ExpiryNotificationItem } from '@/types/dms';
import { generateExcelCsv, downloadFile } from '@/lib/excel-export';

export const DocumentsView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'DOCUMENTS' | 'VERSION_HISTORY' | 'WORKFLOW' | 'REPORTS'>('DOCUMENTS');
  const [isAccessDenied, setIsAccessDenied] = useState(false);

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [selectedStatus, setSelectedStatus] = useState<string>('All');
  const [loading, setLoading] = useState(false);

  const [documents, setDocuments] = useState<DocRecord[]>([]);
  const [expiryNotifications, setExpiryNotifications] = useState<ExpiryNotificationItem[]>([]);
  const [show15DaysOnly, setShow15DaysOnly] = useState(false);
  const [stats, setStats] = useState<DocumentStats>({
    total: 0,
    active: 0,
    expiring: 0,
    draft: 0,
    pending: 0,
    storageBytes: 0,
    storageUsed: '0 B'
  });
  const [documentVersions, setDocumentVersions] = useState<DocumentVersion[]>([]);

  // Sorting
  const [sortBy, setSortBy] = useState<'title' | 'uploadDate' | 'version' | 'size'>('title');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  // Modals
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState<DocRecord | null>(null);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  // New Document Form
  const [newDoc, setNewDoc] = useState<{
    title: string;
    category: string;
    docType: string;
    version: string;
    status: string;
    expiryDate: string;
    description: string;
  }>({
    title: '',
    category: 'SOP',
    docType: 'PDF',
    version: '1.0',
    status: 'Active',
    expiryDate: '',
    description: ''
  });

  const [workflows, setWorkflows] = useState<DocumentWorkflow[]>([]);
  const [auditTrails, setAuditTrails] = useState<DocumentAuditTrail[]>([]);

  // Helper to get auth header
  const getAuthHeaders = (): Record<string, string> => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  useEffect(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        if (payload.role !== 'ADMIN') {
          setIsAccessDenied(true);
        }
      } catch (e) {
        console.error('Failed to parse token in DMS');
      }
    }
  }, []);

  // Data Fetching
  const fetchDmsData = useCallback(async () => {
    setLoading(true);
    try {
      const headers = getAuthHeaders();
      const [docsRes, statsRes, verRes, wfRes, auditRes, notifRes] = await Promise.all([
        fetch(`/api/dms?search=${encodeURIComponent(searchTerm)}&category=${encodeURIComponent(selectedCategory)}&status=${encodeURIComponent(selectedStatus)}`, { headers }),
        fetch('/api/dms/stats', { headers }),
        fetch('/api/dms/versions', { headers }),
        fetch('/api/dms/workflows', { headers }),
        fetch('/api/dms/audits', { headers }),
        fetch('/api/dms/notifications', { headers })
      ]);

      if (docsRes.status === 403 || docsRes.status === 401) {
        setIsAccessDenied(true);
        setLoading(false);
        return;
      }

      if (docsRes.ok) {
        const json = await docsRes.json();
        setDocuments(json.data || json || []);
      }
      if (statsRes.ok) {
        const json = await statsRes.json();
        setStats(json.data || json || { total: 0, active: 0, expiring: 0, draft: 0, pending: 0, storageBytes: 0, storageUsed: '0 B' });
      }
      if (verRes.ok) {
        const json = await verRes.json();
        setDocumentVersions(json.data || json || []);
      }
      if (wfRes.ok) {
        const json = await wfRes.json();
        setWorkflows(json.data || json || []);
      }
      if (auditRes.ok) {
        const json = await auditRes.json();
        setAuditTrails(json.data || json || []);
      }
      if (notifRes.ok) {
        const json = await notifRes.json();
        setExpiryNotifications(json.data?.notifications || []);
      }
    } catch (err) {
      console.error('Failed to load DMS data:', err);
    } finally {
      setLoading(false);
    }
  }, [searchTerm, selectedCategory, selectedStatus]);

  useEffect(() => {
    if (!isAccessDenied) {
      fetchDmsData();
    }
  }, [fetchDmsData, isAccessDenied]);

  // Filtering & Sorting
  const filteredDocs = documents
    .filter(doc => {
      const matchesSearch = doc.title.toLowerCase().includes(searchTerm.toLowerCase()) || doc.id.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCategory = selectedCategory === 'All' || doc.category === selectedCategory;
      
      let matchesStatus = selectedStatus === 'All' || doc.status === selectedStatus;
      if (selectedStatus === 'Expiring15' || show15DaysOnly) {
        if (!doc.expiryDate) return false;
        const diffMs = new Date(doc.expiryDate).getTime() - new Date().getTime();
        const days = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
        matchesStatus = days <= 15;
      }

      return matchesSearch && matchesCategory && matchesStatus;
    })
    .sort((a, b) => {
      let aVal: string | number = '';
      let bVal: string | number = '';
      switch (sortBy) {
        case 'title':
          aVal = a.title.toLowerCase();
          bVal = b.title.toLowerCase();
          break;
        case 'uploadDate':
          aVal = new Date(a.uploadDate).getTime();
          bVal = new Date(b.uploadDate).getTime();
          break;
        case 'version':
          aVal = parseFloat(a.version) || 0;
          bVal = parseFloat(b.version) || 0;
          break;
        case 'size':
          aVal = parseFloat(a.size) || 0;
          bVal = parseFloat(b.size) || 0;
          break;
      }
      if (sortOrder === 'asc') {
        return aVal > bVal ? 1 : aVal < bVal ? -1 : 0;
      } else {
        return aVal < bVal ? 1 : aVal > bVal ? -1 : 0;
      }
    });

  // Actions
  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this document?')) return;
    try {
      const res = await fetch(`/api/dms/${id}`, { method: 'DELETE', headers: getAuthHeaders() });
      if (res.ok) {
        fetchDmsData();
      } else {
        const data = await res.json();
        alert(data.error?.message || data.error || 'Failed to delete document');
      }
    } catch {
      alert('Network error while deleting document');
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) {
      alert('Please select a file to upload');
      return;
    }

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('title', newDoc.title);
      formData.append('category', newDoc.category);
      formData.append('type', newDoc.docType);
      formData.append('version', newDoc.version);
      formData.append('status', newDoc.status);
      formData.append('expiryDate', newDoc.expiryDate);
      formData.append('description', newDoc.description);

      const res = await fetch('/api/dms', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: formData,
      });

      if (res.ok) {
        setShowUploadModal(false);
        setSelectedFile(null);
        setNewDoc({ title: '', category: 'SOP', docType: 'PDF', version: '1.0', status: 'Active', expiryDate: '', description: '' });
        fetchDmsData();
      } else {
        const data = await res.json();
        alert(data.error?.message || data.error || 'Upload failed');
      }
    } catch (err) {
      console.error(err);
      alert('Network error during file upload');
    } finally {
      setIsUploading(false);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') setIsDragging(true);
    else if (e.type === 'dragleave') setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setSelectedFile(e.dataTransfer.files[0]);
    }
  };

  // Export handlers
  const exportDocRegister = () => {
    const headers = ['Document ID', 'Title', 'Category', 'File Type', 'Version', 'Status', 'Author', 'Upload Date', 'Expiry Date', 'Size'];
    const rows = filteredDocs.map(d => [d.id, d.title, d.category, d.type, d.version, d.status, d.author, d.uploadDate, d.expiryDate || '—', d.size]);
    const csv = generateExcelCsv(headers, rows, 'Document Register');
    downloadFile(csv, `DMS_Document_Register_${new Date().toISOString().slice(0, 10)}.csv`);
  };

  const exportVersions = () => {
    const headers = ['Version ID', 'Doc ID', 'Document Title', 'Version Label', 'Uploaded By', 'Upload Date', 'Size', 'Approved By', 'Approval Date'];
    const rows = documentVersions.map(v => [v.id, v.documentId, v.title || '—', v.version, v.uploadedBy, v.uploadDate, `${v.fileSize} B`, v.approvedBy || '—', v.approvalDate || '—']);
    const csv = generateExcelCsv(headers, rows, 'Version Control History');
    downloadFile(csv, `DMS_Version_History_${new Date().toISOString().slice(0, 10)}.csv`);
  };

  const exportWorkflows = () => {
    const headers = ['Workflow ID', 'Doc ID', 'Document Title', 'Current Step', 'Assigned To', 'Due Date', 'Status', 'Updated At'];
    const rows = workflows.map(w => [w.id, w.documentId, w.documentTitle, w.currentStep, w.assignedTo, w.dueDate, w.status, w.updatedAt]);
    const csv = generateExcelCsv(headers, rows, 'Document Approval Workflows');
    downloadFile(csv, `DMS_Workflows_${new Date().toISOString().slice(0, 10)}.csv`);
  };

  const exportAuditTrail = () => {
    const headers = ['Audit ID', 'Doc ID', 'Action', 'User ID', 'User Name', 'Timestamp', 'IP Address', 'Details'];
    const rows = auditTrails.map(a => [a.id, a.documentId, a.action, a.userId, a.userName, a.timestamp, a.ipAddress, a.details]);
    const csv = generateExcelCsv(headers, rows, 'Compliance Audit Trail');
    downloadFile(csv, `DMS_Audit_Trail_${new Date().toISOString().slice(0, 10)}.csv`);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Active':
        return <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">Active</span>;
      case 'Draft':
        return <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">Draft</span>;
      case 'Expiring':
        return <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">Expiring</span>;
      case 'Pending':
        return <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-sky-500/10 text-sky-400 border border-sky-500/20">Pending</span>;
      case 'Archived':
        return <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-500/10 text-slate-400 border border-slate-500/20">Archived</span>;
      default:
        return <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-800 text-slate-400 border border-slate-700">{status}</span>;
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'SOP': return <FileCheck className="w-4 h-4 text-cyan-400" />;
      case 'License': return <Shield className="w-4 h-4 text-emerald-400" />;
      case 'Report': return <BarChart3 className="w-4 h-4 text-indigo-400" />;
      case 'Compliance': return <AlertCircle className="w-4 h-4 text-amber-400" />;
      case 'Policy': return <FileText className="w-4 h-4 text-purple-400" />;
      default: return <Folder className="w-4 h-4 text-slate-400" />;
    }
  };

  if (isAccessDenied) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center p-6 text-center space-y-4 bg-slate-950 text-slate-100 rounded-3xl border border-slate-800 my-8 shadow-2xl">
        <div className="w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400 shadow-xl">
          <Shield className="w-8 h-8" />
        </div>
        <h2 className="text-2xl font-bold text-white">Access Restricted to System Administrators</h2>
        <p className="text-sm text-slate-400 max-w-md">
          The Document Management System (DMS) contains statutory compliance certificates, GST registration files, and confidential company records. Access is strictly reserved for System Administrators only.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6 bg-slate-950 text-slate-100 min-h-screen">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-800/80 pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-3">
            <Folder className="w-7 h-7 text-cyan-400" />
            Document Management System (DMS)
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Enterprise document repository, version control, compliance audit trail, and approval workflows.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => fetchDmsData()}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white hover:border-slate-700 transition"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            onClick={() => setShowUploadModal(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 font-medium text-white shadow-lg shadow-cyan-500/20 hover:opacity-95 transition"
          >
            <Upload className="w-4 h-4" />
            Upload Document
          </button>
        </div>
      </div>

      {/* 15-Day Expiry Notification Alert Banner */}
      {expiryNotifications.length > 0 && (
        <div className="p-4 rounded-2xl bg-amber-950/40 border border-amber-500/40 backdrop-blur-md flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xl shadow-amber-950/30 animate-fade-in">
          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-xl bg-amber-500/20 border border-amber-500/30 text-amber-400 shrink-0">
              <AlertCircle className="w-6 h-6 animate-pulse text-amber-400" />
            </div>
            <div>
              <h3 className="font-bold text-amber-200 text-sm flex items-center gap-2">
                ⚠️ 15-Day Document Expiry Alert ({expiryNotifications.length} Document{expiryNotifications.length > 1 ? 's' : ''})
              </h3>
              <p className="text-xs text-amber-200/80 mt-0.5">
                The following statutory pharma licenses and compliance certificates require renewal within 15 days:
              </p>
              <div className="flex flex-wrap gap-2 mt-2">
                {expiryNotifications.map((n) => (
                  <span
                    key={n.id}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-amber-900/60 text-amber-100 border border-amber-500/40 shadow-sm"
                  >
                    <Clock className="w-3.5 h-3.5 text-amber-400" />
                    <span>{n.title}</span>
                    <span className="bg-amber-500/30 px-1.5 py-0.5 rounded text-[11px] text-amber-300 font-bold border border-amber-400/30">
                      {n.daysRemaining <= 0 ? 'EXPIRED TODAY' : `${n.daysRemaining} days left`}
                    </span>
                  </span>
                ))}
              </div>
            </div>
          </div>
          <button
            onClick={() => {
              const nextVal = !show15DaysOnly;
              setShow15DaysOnly(nextVal);
              setSelectedStatus(nextVal ? 'Expiring15' : 'All');
            }}
            className={`shrink-0 px-4 py-2 rounded-xl text-xs font-bold transition border shadow-md ${
              show15DaysOnly
                ? 'bg-amber-400 text-slate-950 border-amber-300 shadow-amber-500/20'
                : 'bg-amber-500/20 text-amber-200 border-amber-500/40 hover:bg-amber-500/30'
            }`}
          >
            {show15DaysOnly ? '✓ Showing 15-Day Expiring' : 'Filter 15-Day Expiring'}
          </button>
        </div>
      )}

      {/* KPI Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-4">
        <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800/80 backdrop-blur-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Total Docs</span>
            <FileText className="w-4 h-4 text-cyan-400" />
          </div>
          <p className="text-2xl font-bold text-white mt-2">{stats.total}</p>
        </div>
        <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800/80 backdrop-blur-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Active</span>
            <CheckCircle className="w-4 h-4 text-emerald-400" />
          </div>
          <p className="text-2xl font-bold text-white mt-2">{stats.active}</p>
        </div>
        <div className="p-4 rounded-2xl bg-amber-950/20 border border-amber-500/30 backdrop-blur-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-amber-300">Expiring (15d)</span>
            <AlertCircle className="w-4 h-4 text-amber-400 animate-pulse" />
          </div>
          <p className="text-2xl font-bold text-amber-400 mt-2">{stats.expiring15Days ?? expiryNotifications.length}</p>
        </div>
        <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800/80 backdrop-blur-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Expiring (30d)</span>
            <AlertCircle className="w-4 h-4 text-rose-400" />
          </div>
          <p className="text-2xl font-bold text-white mt-2">{stats.expiring}</p>
        </div>
        <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800/80 backdrop-blur-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Drafts</span>
            <Clock className="w-4 h-4 text-amber-400" />
          </div>
          <p className="text-2xl font-bold text-white mt-2">{stats.draft}</p>
        </div>
        <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800/80 backdrop-blur-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Pending Review</span>
            <FileCheck className="w-4 h-4 text-sky-400" />
          </div>
          <p className="text-2xl font-bold text-white mt-2">{stats.pending}</p>
        </div>
        <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800/80 backdrop-blur-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Storage Used</span>
            <HardDrive className="w-4 h-4 text-indigo-400" />
          </div>
          <p className="text-xl font-bold text-white mt-2">{stats.storageUsed}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-800">
        <button
          onClick={() => setActiveTab('DOCUMENTS')}
          className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition ${
            activeTab === 'DOCUMENTS'
              ? 'border-cyan-400 text-cyan-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Folder className="w-4 h-4" />
          Repository ({filteredDocs.length})
        </button>
        <button
          onClick={() => setActiveTab('VERSION_HISTORY')}
          className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition ${
            activeTab === 'VERSION_HISTORY'
              ? 'border-cyan-400 text-cyan-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <History className="w-4 h-4" />
          Version Control ({documentVersions.length})
        </button>
        <button
          onClick={() => setActiveTab('WORKFLOW')}
          className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition ${
            activeTab === 'WORKFLOW'
              ? 'border-cyan-400 text-cyan-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Workflow className="w-4 h-4" />
          Workflows ({workflows.length})
        </button>
        <button
          onClick={() => setActiveTab('REPORTS')}
          className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition ${
            activeTab === 'REPORTS'
              ? 'border-cyan-400 text-cyan-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <FileSpreadsheet className="w-4 h-4" />
          Compliance & Reports
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === 'DOCUMENTS' && (
        <div className="space-y-4">
          {/* Controls */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-slate-900/60 p-4 rounded-2xl border border-slate-800">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search document title or ID..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-200 focus:outline-none focus:border-cyan-500"
              />
            </div>
            <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
              <div className="flex items-center gap-2 text-sm text-slate-400">
                <Filter className="w-4 h-4" />
                <span>Category:</span>
                <select
                  value={selectedCategory}
                  onChange={e => setSelectedCategory(e.target.value)}
                  className="bg-slate-950 border border-slate-800 rounded-xl text-sm px-3 py-1.5 text-slate-200 focus:outline-none focus:border-cyan-500"
                >
                  <option value="All">All Categories</option>
                  <option value="SOP">SOP</option>
                  <option value="License">License</option>
                  <option value="Report">Report</option>
                  <option value="Compliance">Compliance</option>
                  <option value="Policy">Policy</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div className="flex items-center gap-2 text-sm text-slate-400">
                <span>Status:</span>
                <select
                  value={selectedStatus}
                  onChange={e => setSelectedStatus(e.target.value)}
                  className="bg-slate-950 border border-slate-800 rounded-xl text-sm px-3 py-1.5 text-slate-200 focus:outline-none focus:border-cyan-500"
                >
                  <option value="All">All Statuses</option>
                  <option value="Expiring15">⚠️ Expiring within 15 Days</option>
                  <option value="Active">Active</option>
                  <option value="Draft">Draft</option>
                  <option value="Expiring">Expiring</option>
                  <option value="Pending">Pending</option>
                  <option value="Archived">Archived</option>
                </select>
              </div>

              <button
                onClick={exportDocRegister}
                className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 transition"
              >
                <Download className="w-3.5 h-3.5" />
                Export CSV
              </button>
            </div>
          </div>

          {/* Table */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 overflow-hidden backdrop-blur-md">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-300">
                <thead className="bg-slate-950/80 text-xs font-semibold text-slate-400 border-b border-slate-800 uppercase tracking-wider">
                  <tr>
                    <th className="p-4">Document ID</th>
                    <th className="p-4">Title & Details</th>
                    <th className="p-4">Category</th>
                    <th className="p-4">Version</th>
                    <th className="p-4">Status</th>
                    <th className="p-4">Author</th>
                    <th className="p-4">Uploaded</th>
                    <th className="p-4">Size</th>
                    <th className="p-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {filteredDocs.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="p-8 text-center text-slate-500">
                        No documents found matching the search criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredDocs.map(doc => {
                      let daysToExpiry: number | null = null;
                      if (doc.expiryDate) {
                        const diffMs = new Date(doc.expiryDate).getTime() - new Date().getTime();
                        daysToExpiry = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
                      }
                      const isExpiringSoon = daysToExpiry !== null && daysToExpiry <= 15;

                      return (
                        <tr key={doc.id} className={`hover:bg-slate-800/40 transition ${isExpiringSoon ? 'bg-amber-950/10 hover:bg-amber-950/20' : ''}`}>
                          <td className="p-4 font-mono text-cyan-400 font-medium">{doc.id}</td>
                          <td className="p-4">
                            <div className="flex flex-wrap items-center gap-2">
                              <File className="w-4 h-4 text-cyan-400 shrink-0" />
                              <span className="font-medium text-slate-100">{doc.title}</span>
                              {isExpiringSoon && (
                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold border ${daysToExpiry! <= 7 ? 'bg-rose-500/20 text-rose-300 border-rose-500/30 animate-pulse' : 'bg-amber-500/20 text-amber-300 border-amber-500/30'}`}>
                                  <AlertCircle className="w-3 h-3" />
                                  {daysToExpiry! <= 0 ? 'EXPIRED TODAY' : `Expires in ${daysToExpiry}d`}
                                </span>
                              )}
                            </div>
                            {doc.fileName && (
                              <span className="text-xs text-slate-400 block ml-6">{doc.fileName}</span>
                            )}
                          </td>
                        <td className="p-4">
                          <div className="flex items-center gap-1.5">
                            {getCategoryIcon(doc.category)}
                            <span>{doc.category}</span>
                          </div>
                        </td>
                        <td className="p-4 font-mono text-xs">{doc.version}</td>
                        <td className="p-4">{getStatusBadge(doc.status)}</td>
                        <td className="p-4 text-slate-300">{doc.author}</td>
                        <td className="p-4 text-slate-400 text-xs">{doc.uploadDate}</td>
                        <td className="p-4 font-mono text-xs text-slate-400">{doc.size}</td>
                        <td className="p-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => {
                                setSelectedDocument(doc);
                                setShowPreviewModal(true);
                              }}
                              title="View details"
                              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            {doc.fileUrl && (
                              <a
                                href={doc.fileUrl}
                                download
                                title="Download file"
                                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-400 hover:text-cyan-300 transition"
                              >
                                <Download className="w-4 h-4" />
                              </a>
                            )}
                            <button
                              onClick={() => handleDelete(doc.id)}
                              title="Delete document"
                              className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 transition"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'VERSION_HISTORY' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between bg-slate-900/60 p-4 rounded-2xl border border-slate-800">
            <h3 className="font-semibold text-slate-200">Version Change Logs</h3>
            <button
              onClick={exportVersions}
              className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 transition"
            >
              <Download className="w-3.5 h-3.5" />
              Export Version Log
            </button>
          </div>
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 overflow-hidden backdrop-blur-md">
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="bg-slate-950/80 text-xs font-semibold text-slate-400 border-b border-slate-800 uppercase tracking-wider">
                <tr>
                  <th className="p-4">Doc ID</th>
                  <th className="p-4">Document Title</th>
                  <th className="p-4">Version</th>
                  <th className="p-4">Change Log</th>
                  <th className="p-4">Uploaded By</th>
                  <th className="p-4">Approved By</th>
                  <th className="p-4">Upload Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {documentVersions.map(v => (
                  <tr key={v.id} className="hover:bg-slate-800/40 transition">
                    <td className="p-4 font-mono text-cyan-400 text-xs">{v.documentId}</td>
                    <td className="p-4 font-medium text-slate-100">{v.title || '—'}</td>
                    <td className="p-4 font-mono text-xs text-emerald-400">{v.version}</td>
                    <td className="p-4 text-slate-300 text-xs">{v.changeLog || 'Initial version'}</td>
                    <td className="p-4 text-slate-400 text-xs">{v.uploadedBy}</td>
                    <td className="p-4 text-slate-400 text-xs">{v.approvedBy || '—'}</td>
                    <td className="p-4 text-slate-400 text-xs">{v.uploadDate}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'WORKFLOW' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between bg-slate-900/60 p-4 rounded-2xl border border-slate-800">
            <h3 className="font-semibold text-slate-200">Active Workflow Approvals</h3>
            <button
              onClick={exportWorkflows}
              className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 transition"
            >
              <Download className="w-3.5 h-3.5" />
              Export Workflows
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {workflows.map(wf => (
              <div key={wf.id} className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs text-cyan-400 font-medium">{wf.id} — {wf.documentId}</span>
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    wf.status === 'Completed' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                    wf.status === 'In Progress' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                    'bg-sky-500/10 text-sky-400 border border-sky-500/20'
                  }`}>
                    {wf.status}
                  </span>
                </div>
                <h4 className="font-bold text-slate-100">{wf.documentTitle}</h4>
                <div className="flex items-center justify-between text-xs text-slate-400 border-t border-slate-800/80 pt-3">
                  <span>Current Step: <strong className="text-cyan-300">{wf.currentStep}</strong></span>
                  <span>Assigned: <strong className="text-slate-200">{wf.assignedTo}</strong></span>
                  <span>Due: <strong className="text-slate-200">{wf.dueDate}</strong></span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'REPORTS' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-3">
              <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
                <FileText className="w-5 h-5" />
              </div>
              <h4 className="font-bold text-slate-100">Document Register Report</h4>
              <p className="text-xs text-slate-400">Complete listing of all registered documents with statuses and storage usage.</p>
              <button onClick={exportDocRegister} className="w-full py-2 bg-slate-800 hover:bg-slate-700 rounded-xl text-xs font-medium text-cyan-400 transition">
                Download Report (.CSV)
              </button>
            </div>
            <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                <History className="w-5 h-5" />
              </div>
              <h4 className="font-bold text-slate-100">Version History Report</h4>
              <p className="text-xs text-slate-400">Detailed audit log of multi-version edits, uploads, and approval signatures.</p>
              <button onClick={exportVersions} className="w-full py-2 bg-slate-800 hover:bg-slate-700 rounded-xl text-xs font-medium text-emerald-400 transition">
                Download Report (.CSV)
              </button>
            </div>
            <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                <Workflow className="w-5 h-5" />
              </div>
              <h4 className="font-bold text-slate-100">Workflow Approval Report</h4>
              <p className="text-xs text-slate-400">Tracks active, pending, and completed multi-step approval workflows.</p>
              <button onClick={exportWorkflows} className="w-full py-2 bg-slate-800 hover:bg-slate-700 rounded-xl text-xs font-medium text-amber-400 transition">
                Download Report (.CSV)
              </button>
            </div>
            <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-3">
              <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
                <Shield className="w-5 h-5" />
              </div>
              <h4 className="font-bold text-slate-100">Compliance Audit Trail</h4>
              <p className="text-xs text-slate-400">Immutable regulatory trail for created, modified, viewed, and deleted files.</p>
              <button onClick={exportAuditTrail} className="w-full py-2 bg-slate-800 hover:bg-slate-700 rounded-xl text-xs font-medium text-purple-400 transition">
                Download Report (.CSV)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Upload Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Upload className="w-5 h-5 text-cyan-400" />
                Upload New Document
              </h3>
              <button onClick={() => setShowUploadModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUpload} className="space-y-4 text-sm">
              {/* File Dropzone */}
              <div
                onDragEnter={handleDrag}
                onDragOver={handleDrag}
                onDragLeave={handleDrag}
                onDrop={handleDrop}
                className={`border-2 border-dashed rounded-xl p-6 text-center transition ${
                  isDragging ? 'border-cyan-400 bg-cyan-500/10' : 'border-slate-800 bg-slate-950'
                }`}
              >
                <input
                  type="file"
                  id="dms-file-input"
                  className="hidden"
                  onChange={e => e.target.files && setSelectedFile(e.target.files[0])}
                />
                <label htmlFor="dms-file-input" className="cursor-pointer flex flex-col items-center gap-2">
                  <Upload className="w-8 h-8 text-cyan-400" />
                  <span className="text-slate-300 font-medium">
                    {selectedFile ? selectedFile.name : 'Click to select or drag & drop document file'}
                  </span>
                  <span className="text-xs text-slate-500">Supported formats: PDF, DOCX, XLSX, PPTX, JPG, TXT (Max 50MB)</span>
                </label>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Document Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Standard Operating Procedure for Quality Control"
                  value={newDoc.title}
                  onChange={e => setNewDoc({ ...newDoc, title: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Category</label>
                  <select
                    value={newDoc.category}
                    onChange={e => setNewDoc({ ...newDoc, category: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 focus:outline-none focus:border-cyan-500"
                  >
                    <option value="SOP">SOP</option>
                    <option value="License">License</option>
                    <option value="Report">Report</option>
                    <option value="Compliance">Compliance</option>
                    <option value="Policy">Policy</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Version</label>
                  <input
                    type="text"
                    value={newDoc.version}
                    onChange={e => setNewDoc({ ...newDoc, version: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Status</label>
                  <select
                    value={newDoc.status}
                    onChange={e => setNewDoc({ ...newDoc, status: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 focus:outline-none focus:border-cyan-500"
                  >
                    <option value="Active">Active</option>
                    <option value="Draft">Draft</option>
                    <option value="Pending">Pending Review</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Expiry Date (Optional)</label>
                  <input
                    type="date"
                    value={newDoc.expiryDate}
                    onChange={e => setNewDoc({ ...newDoc, expiryDate: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Description / Notes</label>
                <textarea
                  rows={2}
                  value={newDoc.description}
                  onChange={e => setNewDoc({ ...newDoc, description: e.target.value })}
                  placeholder="Additional notes, regulatory standard reference, or version notes..."
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowUploadModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isUploading}
                  className="px-5 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 font-medium text-slate-950 transition disabled:opacity-50"
                >
                  {isUploading ? 'Uploading...' : 'Confirm Upload'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Preview Modal */}
      {showPreviewModal && selectedDocument && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-xl w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <span className="font-mono text-xs text-cyan-400">{selectedDocument.id}</span>
              <button onClick={() => setShowPreviewModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <h3 className="text-lg font-bold text-white">{selectedDocument.title}</h3>

            <div className="grid grid-cols-2 gap-3 text-xs bg-slate-950 p-4 rounded-xl border border-slate-800">
              <div>
                <span className="text-slate-400 block">Category:</span>
                <span className="font-medium text-slate-200">{selectedDocument.category}</span>
              </div>
              <div>
                <span className="text-slate-400 block">Version:</span>
                <span className="font-medium text-emerald-400 font-mono">{selectedDocument.version}</span>
              </div>
              <div>
                <span className="text-slate-400 block">Status:</span>
                <span className="font-medium text-slate-200">{selectedDocument.status}</span>
              </div>
              <div>
                <span className="text-slate-400 block">Author:</span>
                <span className="font-medium text-slate-200">{selectedDocument.author}</span>
              </div>
              <div>
                <span className="text-slate-400 block">Upload Date:</span>
                <span className="font-medium text-slate-200">{selectedDocument.uploadDate}</span>
              </div>
              <div>
                <span className="text-slate-400 block">Expiry Date:</span>
                <span className="font-medium text-slate-200">{selectedDocument.expiryDate || 'N/A'}</span>
              </div>
            </div>

            {selectedDocument.notes && (
              <p className="text-xs text-slate-300 bg-slate-950 p-3 rounded-xl border border-slate-800 italic">
                {selectedDocument.notes}
              </p>
            )}

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
              {selectedDocument.fileUrl && (
                <a
                  href={selectedDocument.fileUrl}
                  download
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 font-medium text-slate-950 transition"
                >
                  <Download className="w-4 h-4" />
                  Download File ({selectedDocument.size})
                </a>
              )}
              <button
                onClick={() => setShowPreviewModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
