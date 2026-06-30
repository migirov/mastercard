import React, { useState } from 'react';
import { MessageSquareWarning } from 'lucide-react';
import { features } from '@/api/features';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import FeatureShell, {
  FeatureCard,
  ResultPanel,
  DataTable,
  KeyValueList,
} from '@/components/features/FeatureShell';

const DEFAULT_REQUEST_ID = '33000000-0000-4000-8000-000000000000';

// RFI Center — retrieve a request, submit a response, upload a document.
// DEMO by default: the sandbox is not onboarded for RFI.
export default function RfiPage() {
  // Shared across the cards: the RFI request id.
  const [requestId, setRequestId] = useState(DEFAULT_REQUEST_ID);

  // Card 1 — retrieve request.
  const [req, setReq] = useState(null);
  const [reqLoading, setReqLoading] = useState(false);
  const [reqError, setReqError] = useState(null);

  // Card 2 — submit response.
  const [respFirstName, setRespFirstName] = useState('');
  const [respLastName, setRespLastName] = useState('');
  const [respMessage, setRespMessage] = useState('');
  const [respRes, setRespRes] = useState(null);
  const [respLoading, setRespLoading] = useState(false);
  const [respError, setRespError] = useState(null);

  // Card 3 — upload document.
  const [doc, setDoc] = useState(null); // { fileName, file (base64) }
  const [uploadRes, setUploadRes] = useState(null);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [uploadError, setUploadError] = useState(null);

  const retrieve = async (e) => {
    e?.preventDefault();
    setReqLoading(true);
    setReqError(null);
    try {
      const r = await features.rfi.retrieve(requestId);
      setReq(r);
    } catch (err) {
      setReqError(err.message || 'Retrieve failed');
      setReq(null);
    } finally {
      setReqLoading(false);
    }
  };

  const respond = async (e) => {
    e?.preventDefault();
    setRespLoading(true);
    setRespError(null);
    try {
      const r = await features.rfi.respond(requestId, {
        firstName: respFirstName,
        lastName: respLastName,
        message: respMessage,
      });
      setRespRes(r);
    } catch (err) {
      setRespError(err.message || 'Submit failed');
      setRespRes(null);
    } finally {
      setRespLoading(false);
    }
  };

  const pickFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) {
      setDoc(null);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      // strip the `data:<mime>;base64,` prefix → raw base64 for the BFF
      setDoc({ fileName: file.name, file: String(reader.result).split(',')[1] });
    };
    reader.onerror = () => {
      setDoc(null);
      setUploadError('Could not read the selected file.');
    };
    reader.readAsDataURL(file);
  };

  const upload = async (e) => {
    e?.preventDefault();
    if (!doc) return;
    setUploadLoading(true);
    setUploadError(null);
    try {
      const r = await features.rfi.upload(doc);
      setUploadRes(r);
    } catch (err) {
      setUploadError(err.message || 'Upload failed');
      setUploadRes(null);
    } finally {
      setUploadLoading(false);
    }
  };

  return (
    <FeatureShell
      icon={MessageSquareWarning}
      title="RFI Center"
      subtitle="Retrieve a Request For Information, submit a response, and upload supporting documents (Mastercard RFI). Demo by default — the sandbox is not onboarded for RFI."
      source={req?.source}
    >
      {/* Card 1 — Retrieve request */}
      <FeatureCard title="Retrieve request">
        <form onSubmit={retrieve} className="flex flex-col gap-3 md:flex-row md:items-end">
          <div className="flex-1">
            <Label className="text-xs">Request ID</Label>
            <Input
              className="mt-1"
              value={requestId}
              onChange={(ev) => setRequestId(ev.target.value)}
              placeholder={DEFAULT_REQUEST_ID}
            />
          </div>
          <Button type="submit" disabled={reqLoading || !requestId}>
            {reqLoading ? 'Retrieving…' : 'Retrieve'}
          </Button>
        </form>

        <ResultPanel
          loading={reqLoading}
          error={reqError}
          empty={!req}
          emptyHint="Retrieve a request to see its questions."
        >
          {req && (
            <div className="space-y-3">
              {req.status && (
                <Badge className="bg-blue-50 text-blue-700 border-blue-200">
                  {req.status}
                </Badge>
              )}
              <DataTable
                columns={[
                  { key: 'label', label: 'Question' },
                  { key: 'code', label: 'Code' },
                  { key: 'required', label: 'Required', render: (r) => (r.required ? 'Yes' : 'No') },
                ]}
                rows={req.questions || []}
              />
            </div>
          )}
        </ResultPanel>
      </FeatureCard>

      {/* Card 2 — Submit response */}
      <FeatureCard title="Submit response">
        <form onSubmit={respond} className="grid md:grid-cols-2 gap-3">
          <div>
            <Label className="text-xs">First name</Label>
            <Input
              className="mt-1"
              value={respFirstName}
              onChange={(ev) => setRespFirstName(ev.target.value)}
              placeholder="Jane"
            />
          </div>
          <div>
            <Label className="text-xs">Last name</Label>
            <Input
              className="mt-1"
              value={respLastName}
              onChange={(ev) => setRespLastName(ev.target.value)}
              placeholder="Doe"
            />
          </div>
          <div className="md:col-span-2">
            <Label className="text-xs">Message</Label>
            <Textarea
              className="mt-1"
              value={respMessage}
              onChange={(ev) => setRespMessage(ev.target.value)}
              placeholder="Response to the request for information…"
              rows={4}
            />
          </div>
          <div className="md:col-span-2">
            <Button type="submit" disabled={respLoading}>
              {respLoading ? 'Submitting…' : 'Submit response'}
            </Button>
          </div>
        </form>

        {respError && (
          <p className="text-sm text-red-600">{String(respError)}</p>
        )}
        {respRes && (
          <p className="text-sm text-green-700">
            Response {respRes.state} for {respRes.requestId}.
          </p>
        )}
      </FeatureCard>

      {/* Card 3 — Upload document */}
      <FeatureCard title="Upload document">
        <div className="grid gap-3">
          <div>
            <Label className="text-xs">Document</Label>
            <input
              type="file"
              onChange={pickFile}
              className="mt-1 block w-full text-sm text-muted-foreground file:mr-3 file:rounded-md file:border file:border-border file:bg-muted file:px-3 file:py-1.5 file:text-sm file:font-medium"
            />
            {doc?.fileName && (
              <p className="mt-1 text-xs text-muted-foreground">Selected: {doc.fileName}</p>
            )}
          </div>
          <div>
            <Button type="button" onClick={upload} disabled={uploadLoading || !doc}>
              {uploadLoading ? 'Uploading…' : 'Upload'}
            </Button>
          </div>
        </div>

        {uploadError && (
          <p className="text-sm text-red-600">{String(uploadError)}</p>
        )}
        {uploadRes && (
          <KeyValueList
            entries={[
              ['Document ID', uploadRes.documentId],
              ['File name', uploadRes.fileName],
              ['State', uploadRes.state],
            ]}
          />
        )}
      </FeatureCard>
    </FeatureShell>
  );
}
