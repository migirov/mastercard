import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertCircle, Upload, MessageSquare, CheckCircle2, FileText, Send, Paperclip, X, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { api } from '@/api/apiClient';

function RfiItem({ rfi, index, onResolve }) {
  const [expanded, setExpanded] = useState(true);
  const [mode, setMode] = useState(null); // 'upload' | 'reply'
  const [replyText, setReplyText] = useState('');
  const [uploadedFile, setUploadedFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    try {
      const res = await api.integrations.Core.UploadFile({ file });
      setUploadedFile({ name: file.name, url: res?.file_url });
    } catch {
      /* surface nothing in the demo; just release the dropzone so the user can retry */
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = () => {
    setSubmitted(true);
    onResolve(index, {
      type: mode,
      content: mode === 'reply' ? replyText : uploadedFile?.url,
      fileName: uploadedFile?.name,
    });
  };

  if (submitted) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        className="flex items-center gap-2.5 p-3 rounded-lg bg-emerald-50 border border-emerald-200"
      >
        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
        <div>
          <p className="text-xs font-semibold text-emerald-700">Response submitted</p>
          <p className="text-[11px] text-emerald-600 mt-0.5">{rfi.item}</p>
        </div>
      </motion.div>
    );
  }

  return (
    <div className="rounded-lg border border-orange-200 overflow-hidden">
      {/* Item header */}
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-start gap-2.5 p-3 bg-orange-50 hover:bg-orange-100 transition-colors text-left"
      >
        <AlertCircle className="w-3.5 h-3.5 text-orange-500 shrink-0 mt-0.5" />
        <span className="flex-1 text-xs text-orange-700 font-medium">{rfi.item}</span>
        {expanded ? <ChevronUp className="w-3.5 h-3.5 text-orange-400 shrink-0" /> : <ChevronDown className="w-3.5 h-3.5 text-orange-400 shrink-0" />}
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="p-3 bg-white space-y-3 border-t border-orange-100">
              {/* Mode selector */}
              {!mode && (
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setMode('upload')}
                    className="flex flex-col items-center gap-1.5 p-3 rounded-lg border border-border hover:border-primary hover:bg-primary/5 transition-all"
                  >
                    <Upload className="w-4 h-4 text-primary" />
                    <span className="text-xs font-medium">Upload Document</span>
                  </button>
                  <button
                    onClick={() => setMode('reply')}
                    className="flex flex-col items-center gap-1.5 p-3 rounded-lg border border-border hover:border-primary hover:bg-primary/5 transition-all"
                  >
                    <MessageSquare className="w-4 h-4 text-primary" />
                    <span className="text-xs font-medium">Send Reply</span>
                  </button>
                </div>
              )}

              {/* Upload mode */}
              {mode === 'upload' && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-medium text-muted-foreground">Upload document</p>
                    <button onClick={() => { setMode(null); setUploadedFile(null); }} className="text-muted-foreground hover:text-foreground">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  {!uploadedFile ? (
                    <label className={`flex flex-col items-center gap-2 p-4 rounded-lg border-2 border-dashed cursor-pointer transition-colors ${uploading ? 'border-primary/30 bg-primary/5' : 'border-border hover:border-primary/50 hover:bg-muted/30'}`}>
                      {uploading ? (
                        <>
                          <div className="w-5 h-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                          <span className="text-xs text-muted-foreground">Uploading...</span>
                        </>
                      ) : (
                        <>
                          <Paperclip className="w-5 h-5 text-muted-foreground" />
                          <span className="text-xs text-muted-foreground">Click to select file</span>
                        </>
                      )}
                      <input type="file" className="hidden" onChange={handleFileChange} accept=".pdf,.png,.jpg,.jpeg,.doc,.docx" />
                    </label>
                  ) : (
                    <div className="flex items-center gap-2 p-2.5 rounded-lg bg-emerald-50 border border-emerald-200">
                      <FileText className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span className="text-xs font-medium text-emerald-700 flex-1 truncate">{uploadedFile.name}</span>
                      <button onClick={() => setUploadedFile(null)} className="text-emerald-500 hover:text-emerald-700">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                  <Button
                    size="sm"
                    className="w-full bg-primary hover:bg-primary/90 text-xs"
                    disabled={!uploadedFile}
                    onClick={handleSubmit}
                  >
                    <Send className="w-3.5 h-3.5 mr-1.5" /> Submit Document
                  </Button>
                </div>
              )}

              {/* Reply mode */}
              {mode === 'reply' && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-medium text-muted-foreground">Write your reply</p>
                    <button onClick={() => { setMode(null); setReplyText(''); }} className="text-muted-foreground hover:text-foreground">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <Textarea
                    placeholder="Provide the required information..."
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    className="text-xs min-h-[80px] resize-none"
                  />
                  <Button
                    size="sm"
                    className="w-full bg-primary hover:bg-primary/90 text-xs"
                    disabled={!replyText.trim()}
                    onClick={handleSubmit}
                  >
                    <Send className="w-3.5 h-3.5 mr-1.5" /> Send Reply
                  </Button>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function RfiWorkflow({ invoice, onAllResolved }) {
  const [resolvedItems, setResolvedItems] = useState({});
  const items = invoice.rfi_items?.length ? invoice.rfi_items : [{ item: 'Additional information required' }];
  const allResolved = items.every((_, i) => resolvedItems[i]);

  const handleResolve = (index, response) => {
    setResolvedItems(prev => ({ ...prev, [index]: response }));
  };

  return (
    <div className="space-y-3">
      {/* Header alert */}
      <div className="flex items-start gap-2 p-3 rounded-lg bg-orange-50 border border-orange-200">
        <AlertCircle className="w-4 h-4 text-orange-600 shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-semibold text-orange-700">Request for Information</p>
          <p className="text-xs text-orange-600 mt-0.5">
            {items.length} item{items.length !== 1 ? 's' : ''} require your response before payment can proceed.
          </p>
        </div>
      </div>

      {/* RFI items */}
      <div className="space-y-2">
        {items.map((rfi, i) => (
          <RfiItem key={i} rfi={rfi} index={i} onResolve={handleResolve} />
        ))}
      </div>

      {/* All resolved CTA */}
      <AnimatePresence>
        {allResolved && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-2"
          >
            <div className="flex items-center gap-2 p-3 rounded-lg bg-emerald-50 border border-emerald-200">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <p className="text-xs font-semibold text-emerald-700">All items responded — your payment will be reviewed shortly.</p>
            </div>
            {onAllResolved && (
              <Button
                className="w-full bg-accent hover:bg-accent/90 text-accent-foreground font-semibold"
                onClick={onAllResolved}
              >
                <CheckCircle2 className="w-4 h-4 mr-2" /> Done
              </Button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}