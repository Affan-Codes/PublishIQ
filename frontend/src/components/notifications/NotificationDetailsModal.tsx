import React from 'react';
import { useNavigate } from 'react-router-dom';
import { X, ExternalLink, Clock, CheckCircle2, AlertTriangle, Info, Bell, Trash2, Check } from 'lucide-react';
import { Button } from '../ui/Button.js';

export interface NotificationItem {
  id: string;
  message: string;
  readAt: string | null;
  createdAt: string;
  domainEvent?: {
    id: string;
    type: string;
    jobId?: string | null;
    payload?: any;
    createdAt: string;
  };
}

export interface NotificationDetailsModalProps {
  notification: NotificationItem | null;
  onClose: () => void;
  onMarkRead?: (id: string) => void;
  onDelete?: (id: string) => void;
  isMarkingRead?: boolean;
  isDeleting?: boolean;
}

export const NotificationDetailsModal: React.FC<NotificationDetailsModalProps> = ({
  notification,
  onClose,
  onMarkRead,
  onDelete,
  isMarkingRead = false,
  isDeleting = false,
}) => {
  const navigate = useNavigate();

  if (!notification) return null;

  const eventType = notification.domainEvent?.type || 'Notification';
  const isError = eventType.includes('Failed') || eventType.includes('Error');
  const isWarning = eventType.includes('Approval') || eventType.includes('Warning');
  const severity = isError ? 'Error' : isWarning ? 'Warning' : 'Info';
  const jobId = notification.domainEvent?.jobId || notification.domainEvent?.payload?.jobId;

  const getSeverityBadge = () => {
    switch (severity) {
      case 'Error':
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-500/10 border border-rose-500/20 px-2.5 py-0.5 text-xs font-semibold text-rose-400">
            <AlertTriangle size={12} /> Error
          </span>
        );
      case 'Warning':
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 border border-amber-500/20 px-2.5 py-0.5 text-xs font-semibold text-amber-400">
            <AlertTriangle size={12} /> Warning
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-purple-500/10 border border-purple-500/20 px-2.5 py-0.5 text-xs font-semibold text-purple-400">
            <Info size={12} /> Info
          </span>
        );
    }
  };

  const handleDeepLink = () => {
    onClose();
    if (jobId) {
      navigate('/jobs');
    } else if (eventType.includes('Channel')) {
      navigate('/channels');
    } else if (eventType.includes('Publish')) {
      navigate('/publishing-history');
    } else if (eventType.includes('Content')) {
      navigate('/content-profiles');
    } else {
      navigate('/jobs');
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/75 backdrop-blur-sm p-4 sm:p-6 flex justify-center items-start sm:items-center py-10 sm:py-12">
      <div className="w-full max-w-xl rounded-2xl border border-[#1a1a24] bg-[#0e0e12] p-6 space-y-6 shadow-2xl my-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#1a1a24] pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-purple-600/10 border border-purple-500/20 text-purple-400">
              <Bell size={20} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">Notification Details</h3>
              <p className="text-xs text-[#9c9cb0]">System Diagnostic & Domain Event Summary</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-[#6e6e80] hover:text-white transition cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        {/* Status Badges */}
        <div className="flex items-center justify-between bg-[#14141e] p-4 rounded-xl border border-[#1a1a24]">
          <div className="flex items-center gap-2">
            {getSeverityBadge()}
            <span className="rounded-full bg-[#1e1e2d] border border-[#2b2b3d] px-2.5 py-0.5 text-xs font-mono text-[#9c9cb0]">
              Type: {eventType}
            </span>
          </div>

          <span
            className={`text-xs font-semibold px-2 py-0.5 rounded-md ${
              notification.readAt
                ? 'bg-gray-500/10 text-gray-400 border border-gray-500/20'
                : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
            }`}
          >
            {notification.readAt ? 'Read' : 'Unread'}
          </span>
        </div>

        {/* Notification Message */}
        <div className="space-y-2">
          <label className="text-xs font-semibold uppercase tracking-wider text-[#6e6e80]">
            Notification Message
          </label>
          <p className="text-sm font-medium text-white bg-[#151522] p-4 rounded-xl border border-[#222235] leading-relaxed">
            {notification.message}
          </p>
        </div>

        {/* Timestamps */}
        <div className="grid grid-cols-2 gap-4 text-xs bg-[#13131d] p-4 rounded-xl border border-[#20202e]">
          <div>
            <span className="text-[#6e6e80] flex items-center gap-1">
              <Clock size={12} /> Received Time:
            </span>
            <p className="font-mono text-white mt-1">
              {new Date(notification.createdAt).toLocaleString()}
            </p>
          </div>
          <div>
            <span className="text-[#6e6e80] flex items-center gap-1">
              <CheckCircle2 size={12} /> Read Time:
            </span>
            <p className="font-mono text-white mt-1">
              {notification.readAt ? new Date(notification.readAt).toLocaleString() : 'Unread'}
            </p>
          </div>
        </div>

        {/* Related Entity Details */}
        {jobId && (
          <div className="space-y-2 bg-purple-950/20 border border-purple-500/30 p-4 rounded-xl">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-purple-300">
                Related Entity Reference
              </span>
              <span className="font-mono text-xs text-purple-400">Job ID: {jobId}</span>
            </div>
            <p className="text-xs text-[#9c9cb0]">
              This notification was emitted by the Content Pipeline engine during execution.
            </p>
            <div className="pt-1">
              <Button
                size="sm"
                variant="primary"
                icon={ExternalLink}
                onClick={handleDeepLink}
              >
                Navigate to Job Monitor
              </Button>
            </div>
          </div>
        )}

        {/* Domain Event Payload Inspection */}
        {notification.domainEvent?.payload && (
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-[#6e6e80]">
              Raw Event Payload Metadata
            </label>
            <pre className="text-xs font-mono text-purple-200 bg-[#0b0b11] p-3 rounded-xl border border-[#1b1b26] max-h-36 overflow-y-auto whitespace-pre-wrap">
              {JSON.stringify(notification.domainEvent.payload, null, 2)}
            </pre>
          </div>
        )}

        {/* Action Footer */}
        <div className="flex justify-between items-center border-t border-[#1a1a24] pt-4">
          <div>
            {onDelete && (
              <Button
                size="sm"
                variant="ghost"
                icon={Trash2}
                isLoading={isDeleting}
                loadingText="Deleting..."
                onClick={() => {
                  onDelete(notification.id);
                  onClose();
                }}
                className="text-rose-400 hover:text-rose-300 hover:bg-rose-500/10"
              >
                Delete Notification
              </Button>
            )}
          </div>

          <div className="flex gap-2">
            {!notification.readAt && onMarkRead && (
              <Button
                size="sm"
                variant="outline"
                icon={Check}
                isLoading={isMarkingRead}
                loadingText="Marking..."
                onClick={() => onMarkRead(notification.id)}
              >
                Mark as Read
              </Button>
            )}
            <Button size="sm" variant="secondary" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NotificationDetailsModal;
