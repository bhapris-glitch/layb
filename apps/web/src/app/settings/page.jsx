'use client';

import React, { useState, useEffect } from 'react';
import { fetchApi } from '../../lib/api';
import { Save } from 'lucide-react';

export default function SettingsPage() {
  const [settings, setSettings] = useState({
    botName: 'Layboka AI',
    primaryColor: '#FA4029',
    systemPrompt: 'You are a helpful ecommerce assistant.',
    autoEscalate: true,
  });
  const [saving, setSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');

  useEffect(() => {
    async function loadSettings() {
      try {
        const data = await fetchApi('/merchant-settings');
        if (data.data) setSettings(data.data);
      } catch (err) {
        console.error('Failed to fetch merchant settings', err);
      }
    }
    loadSettings();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setStatusMessage('');
    try {
      await fetchApi('/merchant-settings', {
        method: 'PUT',
        body: JSON.stringify(settings),
      });
      setStatusMessage('Settings successfully saved!');
    } catch (err) {
      setStatusMessage('Error updating settings.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h2 className="text-xl font-bold text-dark-text">Bot & Store Settings</h2>
        <p className="text-sm text-dark-muted">Customize your AI assistant's responses and appearance.</p>
      </div>

      <form onSubmit={handleSubmit} className="bg-dark-surface border border-dark-border rounded-2xl p-6 space-y-6">
        <div>
          <label className="block text-sm font-medium text-dark-text mb-2">Assistant Name</label>
          <input
            type="text"
            value={settings.botName}
            onChange={(e) => setSettings({ ...settings, botName: e.target.value })}
            className="w-full bg-dark-bg border border-dark-border rounded-xl p-3 text-sm text-dark-text focus:outline-none focus:border-brand-PRIMARY"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-dark-text mb-2">Widget Accent Color</label>
          <div className="flex gap-4 items-center">
            <input
              type="color"
              value={settings.primaryColor}
              onChange={(e) => setSettings({ ...settings, primaryColor: e.target.value })}
              className="w-12 h-12 rounded-lg bg-transparent border-0 cursor-pointer"
            />
            <span className="text-sm font-mono text-dark-muted">{settings.primaryColor}</span>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-dark-text mb-2">AI Persona / Instructions</label>
          <textarea
            rows={4}
            value={settings.systemPrompt}
            onChange={(e) => setSettings({ ...settings, systemPrompt: e.target.value })}
            className="w-full bg-dark-bg border border-dark-border rounded-xl p-3 text-sm text-dark-text focus:outline-none focus:border-brand-PRIMARY"
          />
        </div>

        {statusMessage && (
          <p className={`text-sm ${statusMessage.includes('Error') ? 'text-red-400' : 'text-emerald-400'}`}>
            {statusMessage}
          </p>
        )}

        <button
          type="submit"
          disabled={saving}
          className="flex items-center gap-2 px-6 py-3 bg-brand-PRIMARY hover:bg-brand-hover text-white font-medium text-sm rounded-xl transition-colors disabled:opacity-50"
        >
          <Save className="w-4 h-4" />
          {saving ? 'Saving...' : 'Save Configuration'}
        </button>
      </form>
    </div>
  );
}
