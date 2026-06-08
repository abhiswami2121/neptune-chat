'use client';

import { useState, useEffect } from 'react';
import { NeptuneSidebar } from '@/components/sidebar/neptune-sidebar';
import { Key, CheckCircle, AlertTriangle, XCircle, RefreshCw } from 'lucide-react';

interface KeyStatus {
  key: string;
  status: 'configured' | 'pending' | 'missing';
  category: string;
  lastChecked?: string;
}

const VAULT_KEYS: KeyStatus[] = [
  // Model Providers
  { key: 'DEEPSEEK_API_KEY', status: 'configured', category: 'AI Models' },
  { key: 'AI_GATEWAY_API_KEY', status: 'configured', category: 'AI Models' },
  { key: 'ANTHROPIC_API_KEY', status: 'pending', category: 'AI Models' },
  { key: 'OPENAI_API_KEY', status: 'pending', category: 'AI Models' },
  { key: 'GOOGLE_API_KEY', status: 'pending', category: 'AI Models' },
  { key: 'XAI_API_KEY', status: 'pending', category: 'AI Models' },
  { key: 'GROQ_API_KEY', status: 'pending', category: 'AI Models' },
  // Communication
  { key: 'SLACK_BOT_TOKEN', status: 'configured', category: 'Communication' },
  // Billing
  { key: 'NMI_SECURITY_KEY', status: 'configured', category: 'Billing' },
  // Infrastructure
  { key: 'VERCEL_TOKEN', status: 'configured', category: 'Infrastructure' },
  { key: 'VERCEL_PARTNER_TOKEN', status: 'pending', category: 'Infrastructure' },
  { key: 'POSTGRES_URL', status: 'configured', category: 'Infrastructure' },
  { key: 'REDIS_URL', status: 'configured', category: 'Infrastructure' },
  { key: 'BLOB_READ_WRITE_TOKEN', status: 'configured', category: 'Infrastructure' },
  // CRM
  { key: 'BASE44_API_KEY', status: 'configured', category: 'CRM' },
  // Productivity
  { key: 'LINEAR_API_KEY', status: 'configured', category: 'Productivity' },
  { key: 'FORTH_API_TOKEN', status: 'pending', category: 'Productivity' },
  { key: 'NEPTUNE_V2_API_KEY', status: 'pending', category: 'Neptune' },
];

const StatusIcon = ({ status }: { status: string }) => {
  switch (status) {
    case 'configured': return <CheckCircle size={16} className="text-green-500" />;
    case 'pending': return <AlertTriangle size={16} className="text-yellow-500" />;
    case 'missing': return <XCircle size={16} className="text-red-500" />;
    default: return null;
  }
};

export default function VaultPage() {
  const [keys] = useState(VAULT_KEYS);
  const categories = [...new Set(keys.map(k => k.category))];

  return (
    <div className="flex h-dvh">
      <NeptuneSidebar />
      <main className="flex-1 p-6 overflow-y-auto">
        <div className="max-w-3xl">
          <h1 className="text-2xl font-bold mb-2 flex items-center gap-2">
            <Key size={24} /> Secrets Vault
          </h1>
          <p className="text-muted-foreground mb-6">
            API keys and secrets stored encrypted on VPS. Values never leave the server.
          </p>

          {categories.map(cat => (
            <div key={cat} className="mb-6">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2">{cat}</h2>
              <div className="border rounded-lg divide-y">
                {keys.filter(k => k.category === cat).map(k => (
                  <div key={k.key} className="flex items-center justify-between p-3 hover:bg-muted/50">
                    <div className="flex items-center gap-3">
                      <StatusIcon status={k.status} />
                      <div>
                        <p className="text-sm font-mono">{k.key}</p>
                        <p className="text-xs text-muted-foreground">
                          {k.status === 'configured' ? 'Configured and active' :
                           k.status === 'pending' ? 'Pending — user not yet provided' :
                           'Not configured'}
                        </p>
                      </div>
                    </div>
                    <span className="text-xs px-2 py-1 rounded-full bg-muted">
                      {k.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}

          <p className="text-xs text-muted-foreground mt-4">
            <RefreshCw size={12} className="inline mr-1" />
            Secrets stored in /etc/newleaf/.env (chmod 600). Vault UI never sees actual values.
          </p>
        </div>
      </main>
    </div>
  );
}
