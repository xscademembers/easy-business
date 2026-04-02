'use client';

import { useState } from 'react';
import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';
import { Send, CheckCircle, Loader2, Mail } from 'lucide-react';

export default function ContactPage() {
  const [form, setForm] = useState({ name: '', email: '', message: '' });
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');

    try {
      const res = await fetch('/api/contacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });

      if (!res.ok) throw new Error('Failed to send');
      setSuccess(true);
      setForm({ name: '', email: '', message: '' });
    } catch {
      setError('Failed to send message. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Navbar />
      <main className="min-h-screen py-16">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
              style={{ backgroundColor: 'var(--accent-light)' }}
            >
              <Mail size={28} style={{ color: 'var(--accent)' }} />
            </div>
            <h1
              className="text-3xl md:text-4xl font-bold mb-3"
              style={{ color: 'var(--text-primary)' }}
            >
              Contact Us
            </h1>
            <p
              className="text-lg"
              style={{ color: 'var(--text-secondary)' }}
            >
              Have a question or feedback? We&apos;d love to hear from you.
            </p>
          </div>

          {success ? (
            <div className="card text-center py-12">
              <CheckCircle
                size={56}
                className="mx-auto mb-4"
                style={{ color: 'var(--success)' }}
              />
              <h2
                className="text-xl font-bold mb-2"
                style={{ color: 'var(--text-primary)' }}
              >
                Message Sent!
              </h2>
              <p
                className="mb-6"
                style={{ color: 'var(--text-secondary)' }}
              >
                Thank you for reaching out. We&apos;ll get back to you soon.
              </p>
              <button
                onClick={() => setSuccess(false)}
                className="btn-primary"
              >
                Send Another Message
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="card space-y-6">
              <div>
                <label
                  className="block text-sm font-medium mb-1.5"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  Your Name
                </label>
                <input
                  type="text"
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="input-field"
                  placeholder="John Doe"
                />
              </div>
              <div>
                <label
                  className="block text-sm font-medium mb-1.5"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  Email Address
                </label>
                <input
                  type="email"
                  required
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="input-field"
                  placeholder="john@example.com"
                />
              </div>
              <div>
                <label
                  className="block text-sm font-medium mb-1.5"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  Message
                </label>
                <textarea
                  required
                  rows={5}
                  value={form.message}
                  onChange={(e) =>
                    setForm({ ...form, message: e.target.value })
                  }
                  className="input-field resize-none"
                  placeholder="How can we help you?"
                />
              </div>

              {error && (
                <p
                  className="text-sm px-4 py-3 rounded-xl"
                  style={{
                    backgroundColor: 'color-mix(in srgb, var(--danger) 10%, transparent)',
                    color: 'var(--danger)',
                  }}
                >
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {submitting ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Send size={18} />
                    Send Message
                  </>
                )}
              </button>
            </form>
          )}
        </div>
      </main>
      <Footer />
    </>
  );
}
