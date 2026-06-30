import React, { useState } from 'react';
import { Activity } from 'lucide-react';
import { features } from '@/api/features';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import FeatureShell, {
  FeatureCard,
  ResultPanel,
  DataTable,
  KeyValueList,
} from '@/components/features/FeatureShell';

// Payment Tracker — look up a payment's status + history by reference, and cancel by id (demo by default).
export default function PaymentTrackerPage() {
  // Track card state.
  const [ref, setRef] = useState('XBSDEMO12345');
  const [track, setTrack] = useState(null);
  const [trackLoading, setTrackLoading] = useState(false);
  const [trackError, setTrackError] = useState(null);

  // Cancel card state.
  const [id, setId] = useState('');
  const [cancelRes, setCancelRes] = useState(null);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [cancelError, setCancelError] = useState(null);

  const onTrack = async (e) => {
    e?.preventDefault();
    setTrackLoading(true);
    setTrackError(null);
    try {
      const r = await features.paymentTracker.track(ref);
      setTrack(r);
    } catch (err) {
      setTrackError(err.message || 'Tracking failed');
      setTrack(null);
    } finally {
      setTrackLoading(false);
    }
  };

  const onCancel = async (e) => {
    e?.preventDefault();
    setCancelLoading(true);
    setCancelError(null);
    try {
      const r = await features.paymentTracker.cancel(id);
      setCancelRes(r);
    } catch (err) {
      setCancelError(err.message || 'Cancel failed');
      setCancelRes(null);
    } finally {
      setCancelLoading(false);
    }
  };

  return (
    <FeatureShell
      icon={Activity}
      title="Payment Tracker"
      subtitle="Look up a payment's status and history by reference, and cancel a payment by id."
      source={track?.source}
    >
      <FeatureCard title="Track payment">
        <form onSubmit={onTrack} className="grid md:grid-cols-3 gap-3">
          <div className="md:col-span-2">
            <Label className="text-xs">Payment reference</Label>
            <Input
              className="mt-1"
              value={ref}
              onChange={(e) => setRef(e.target.value)}
              placeholder="XBSDEMO12345"
            />
          </div>
          <div className="md:col-span-3">
            <Button type="submit" disabled={trackLoading || !ref}>
              {trackLoading ? 'Tracking…' : 'Track'}
            </Button>
          </div>
        </form>

        <ResultPanel
          loading={trackLoading}
          error={trackError}
          empty={!track}
          emptyHint="Track a payment to see its status and history."
        >
          {track && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm text-muted-foreground">Current status</span>
                <Badge>{track.status || '—'}</Badge>
                {track.stage && (
                  <span className="text-sm text-muted-foreground">· {track.stage}</span>
                )}
              </div>
              <DataTable
                columns={[
                  { key: 'status', label: 'Status' },
                  { key: 'stage', label: 'Stage' },
                  {
                    key: 'timestamp',
                    label: 'Time',
                    render: (r) =>
                      r.timestamp ? new Date(r.timestamp).toLocaleString() : '—',
                  },
                ]}
                rows={track.history || []}
              />
            </div>
          )}
        </ResultPanel>
      </FeatureCard>

      <FeatureCard title="Cancel payment">
        <form onSubmit={onCancel} className="grid md:grid-cols-3 gap-3">
          <div className="md:col-span-2">
            <Label className="text-xs">Payment id</Label>
            <Input
              className="mt-1"
              value={id}
              onChange={(e) => setId(e.target.value)}
              placeholder="payment-id"
            />
          </div>
          <div className="md:col-span-3">
            <Button type="submit" variant="outline" disabled={cancelLoading || !id}>
              {cancelLoading ? 'Cancelling…' : 'Cancel payment'}
            </Button>
          </div>
        </form>

        <ResultPanel
          loading={cancelLoading}
          error={cancelError}
          empty={!cancelRes}
          emptyHint="Enter a payment id to cancel it."
        >
          {cancelRes && (
            <KeyValueList
              entries={[
                ['Payment id', cancelRes?.id],
                ['State', cancelRes?.state],
              ]}
            />
          )}
        </ResultPanel>
      </FeatureCard>
    </FeatureShell>
  );
}
