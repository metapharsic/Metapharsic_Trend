import { Metadata } from 'next';
import { DocumentsView } from '@/components/dms/documents-view';

export const metadata: Metadata = {
  title: 'Document Management System (DMS) | Metapharsic ERP',
  description: 'Enterprise Document Management System, version control, compliance audit trail, and approval workflows.',
};

export default function DmsPage() {
  return <DocumentsView />;
}
