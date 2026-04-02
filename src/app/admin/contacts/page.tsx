'use client';

import { useEffect, useState } from 'react';
import { MessageSquare, Loader2, Mail, Check } from 'lucide-react';

export default function ContactsPage() {
  const [contacts, setContacts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/contacts')
      .then((r) => r.json())
      .then((data) => setContacts(data.contacts || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const markRead = async (id: string) => {
    try {
      await fetch('/api/contacts', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      setContacts((prev) =>
        prev.map((c) => (c._id === id ? { ...c, read: true } : c))
      );
    } catch {
      /* ignore */
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2
          size={32}
          className="animate-spin"
          style={{ color: 'var(--accent)' }}
        />
      </div>
    );
  }

  const unread = contacts.filter((c) => !c.read).length;

  return (
    <div className="space-y-6">
      <div>
        <h1
          className="text-2xl font-bold mb-1"
          style={{ color: 'var(--text-primary)' }}
        >
          Contact Messages
          {unread > 0 && (
            <span
              className="ml-2 text-sm font-normal px-2.5 py-0.5 rounded-full"
              style={{
                backgroundColor: 'var(--danger)',
                color: '#fff',
              }}
            >
              {unread} new
            </span>
          )}
        </h1>
        <p style={{ color: 'var(--text-secondary)' }}>
          Customer queries and feedback
        </p>
      </div>

      {contacts.length === 0 ? (
        <div className="card text-center py-12">
          <MessageSquare
            size={48}
            className="mx-auto mb-3"
            style={{ color: 'var(--text-muted)' }}
          />
          <p style={{ color: 'var(--text-secondary)' }}>
            No messages yet. Contact form submissions will appear here.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {contacts.map((contact: any) => (
            <article
              key={contact._id}
              className="card"
              style={{
                borderLeft: contact.read
                  ? undefined
                  : '3px solid var(--accent)',
              }}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
                    style={{
                      backgroundColor: contact.read
                        ? 'var(--bg-tertiary)'
                        : 'var(--accent-light)',
                    }}
                  >
                    <Mail
                      size={18}
                      style={{
                        color: contact.read
                          ? 'var(--text-muted)'
                          : 'var(--accent)',
                      }}
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <p
                        className="font-semibold truncate"
                        style={{ color: 'var(--text-primary)' }}
                      >
                        {contact.name}
                      </p>
                      {!contact.read && (
                        <span
                          className="w-2 h-2 rounded-full shrink-0"
                          style={{ backgroundColor: 'var(--accent)' }}
                        />
                      )}
                    </div>
                    <p
                      className="text-sm truncate"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      {contact.email}
                    </p>
                    <p
                      className="text-sm mt-2 whitespace-pre-wrap"
                      style={{ color: 'var(--text-secondary)' }}
                    >
                      {contact.message}
                    </p>
                    <p
                      className="text-xs mt-2"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      {new Date(contact.createdAt).toLocaleString()}
                    </p>
                  </div>
                </div>

                {!contact.read && (
                  <button
                    onClick={() => markRead(contact._id)}
                    className="p-2 rounded-lg transition-colors shrink-0"
                    style={{ color: 'var(--success)' }}
                    title="Mark as read"
                  >
                    <Check size={18} />
                  </button>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
