import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Download, ExternalLink, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { safeHttpUrl } from '@/lib/utils';

function isPdf(url) {
  return url?.toLowerCase().includes('.pdf') || url?.toLowerCase().includes('pdf');
}

export default function InvoiceDocViewer({ fileUrl, invoiceNumber, onClose }) {
  if (!fileUrl) return null;

  // Only http(s) URLs are renderable into href/iframe/img — the entity store is open, so a
  // stored javascript:/data: URL must never reach these sinks.
  const safe = safeHttpUrl(fileUrl);
  const pdf = isPdf(safe);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[70] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.92, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.92, opacity: 0 }}
          transition={{ type: 'spring', damping: 28, stiffness: 300 }}
          onClick={(e) => e.stopPropagation()}
          className="bg-card rounded-2xl shadow-2xl border border-border overflow-hidden flex flex-col w-full max-w-3xl max-h-[90vh]"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-border shrink-0">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-primary" />
              <span className="font-semibold text-sm">Invoice #{invoiceNumber}</span>
            </div>
            <div className="flex items-center gap-2">
              {safe && (
                <>
                  <a href={safe} download target="_blank" rel="noopener noreferrer">
                    <Button variant="outline" size="sm" className="gap-1.5 text-xs h-8">
                      <Download className="w-3.5 h-3.5" /> Download
                    </Button>
                  </a>
                  <a href={safe} target="_blank" rel="noopener noreferrer">
                    <Button variant="outline" size="sm" className="gap-1.5 text-xs h-8">
                      <ExternalLink className="w-3.5 h-3.5" /> Open
                    </Button>
                  </a>
                </>
              )}
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}>
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Document viewer */}
          <div className="flex-1 overflow-auto bg-muted/30 min-h-[400px] flex items-center justify-center">
            {!safe ? (
              <p className="text-sm text-muted-foreground p-6 text-center">
                Document preview is unavailable (only http(s) links are shown).
              </p>
            ) : pdf ? (
              <iframe
                src={safe}
                title={`Invoice ${invoiceNumber}`}
                className="w-full h-full min-h-[500px] border-0"
              />
            ) : (
              <img
                src={safe}
                alt={`Invoice ${invoiceNumber}`}
                className="max-w-full max-h-[70vh] object-contain rounded-lg shadow-md"
              />
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}