import React from 'react';
import { LogIn } from 'lucide-react';

const EFFORT_TIP =
  'Thinking effort: how hard the AI thinks before each step. Higher is slower and uses more of your plan or credits, but plans and checks model edits more carefully. High is the default for editing.';
const OUTSIDE_CHECK_TIP =
  'Outside check: when the AI says a model edit is finished, a separate AI that never saw its work judges your request, what it promised to keep and the before/after pictures. A doubtful result goes back for more work before you see it. Costs one extra AI call per finished edit.';

export default function AiConnectionSettings({ settings, setSettings, authBusy, anyBusy, models, providers: PROVIDERS, saveSettings, authenticate, loadModels, apiKey, setApiKey, signedIn, changeProvider, action, setStatus }) {
  const provider = PROVIDERS.find(p => p.id === settings.provider) || {},
    native = !!provider.native;
  return (<>
                    <label title="Which AI service to use.">
                      AI provider
                      <select
                        aria-label="AI provider" data-hotkey="provider"
                        value={settings.provider}
                        disabled={anyBusy || authBusy}
                        onChange={event => changeProvider(event.target.value)}
                      >
                        {PROVIDERS.map(({ id: value, label }) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </label>
                    {native ? (
                      <div className="ai-row">
                        <button
                          className={signedIn ? '' : 'ai-primary'}
                          disabled={anyBusy || authBusy}
                          title="Sign in with your account in the browser." data-hotkey="sign-in" data-hotkey-label="Sign in"
                          onClick={() => authenticate('login')}
                        >
                          <LogIn size={14} aria-hidden="true" />
                          Sign in
                        </button>
                        <button disabled={anyBusy || authBusy} title="Check if you are signed in." data-hotkey="check-sign-in" data-hotkey-label="Check sign-in" onClick={() => authenticate('status')}>
                          Check sign-in
                        </button>
                        <button disabled={anyBusy || authBusy} title="Sign out of this AI." data-hotkey="sign-out" data-hotkey-label="Sign out" onClick={() => authenticate('logout')}>
                          Sign out
                        </button>
                        {authBusy && (
                          <button title="Stop waiting for sign-in." data-hotkey="cancel-sign-in" data-hotkey-label="Stop sign-in" onClick={() => window.desktop.aiCancel()}>
                            Cancel
                          </button>
                        )}
                      </div>
                    ) : provider.apiKey && (
                      <label title="Your key for the AI service, stored encrypted.">
                        API key
                        <input
                          type="password"
                          data-hotkey="api-key" data-hotkey-label="API key" autoComplete="off"
                          value={apiKey}
                          placeholder={settings.hasKey ? 'Saved securely' : ''}
                          onChange={event => setApiKey(event.target.value)}
                        />
                      </label>
                    )}
                    {provider.baseUrl && (
                      <label title="Address of the AI server.">
                        API base URL
                        <input
                          data-hotkey="base-url" data-hotkey-label="API base URL" value={settings.baseUrl || ''}
                          placeholder="http://localhost:1234/v1"
                          onChange={event =>
                            setSettings(previous => ({ ...previous, baseUrl: event.target.value }))
                          }
                        />
                      </label>
                    )}
                    <label title="Which model to use.">
                      Model
                      <input
                        aria-label="Model" data-hotkey="model"
                        list="mdlxl-ai-models"
                        value={settings.model || ''}
                        placeholder={native ? 'Provider default' : 'Choose or enter a model ID'}
                        onChange={event => setSettings(previous => ({ ...previous, model: event.target.value }))}
                      />
                      <datalist id="mdlxl-ai-models">
                        {models.map(model => (
                          <option key={model.id} value={model.id}>
                            {model.name}
                          </option>
                        ))}
                      </datalist>
                    </label>
                    {!!settings.lighterModels?.length && (<>
                      <label title="Use a lighter available model for exact value changes and factual reports. Shape or motion work asks first. Failed reviews hand over to the chosen model.">
                        <input data-hotkey="allow-lighter" data-hotkey-label="Allow lighter models" type="checkbox" checked={settings.allowLighter === true} onChange={event => setSettings(previous => ({ ...previous, allowLighter: event.target.checked }))} />
                        Allow lighter models for simple jobs
                      </label>
                      {settings.allowLighter && <label title="Choose from lighter models returned by this connection.">Lighter model
                        <select aria-label="Lighter model" data-hotkey="lighter-model" value={settings.lightModel || settings.lighterModels[0].id} onChange={event => setSettings(previous => ({ ...previous, lightModel: event.target.value }))}>
                          {settings.lighterModels.map(model => <option key={model.id} value={model.id}>{model.name || model.id}</option>)}
                        </select>
                      </label>}
                    </>)}
                    {provider.effort && (
                      <label title={EFFORT_TIP}>
                        Thinking effort
                        <select aria-label="Thinking effort" data-hotkey="thinking-effort" value={settings.effort || 'high'} onChange={event => setSettings(previous => ({ ...previous, effort: event.target.value }))}>
                          <option value="default">{'Provider default'}</option>
                          <option value="medium">{'Medium'}</option>
                          <option value="high">{'High'}</option>
                          <option value="xhigh">{'Extra high'}</option>
                        </select>
                      </label>
                    )}
                    <label title="Manual sends to the current bird until you choose New job. Automatic lets the organiser delegate unaddressed messages based on task complexity. Both lets you choose in the composer.">
                      Job routing
                      <select aria-label="Job routing" data-hotkey="job-routing" value={settings.routing || 'manual'} onChange={event => setSettings(previous => ({ ...previous, routing: event.target.value }))}>
                        <option value="manual">Manual</option>
                        <option value="automatic">Automatic</option>
                        <option value="both">Both</option>
                      </select>
                    </label>
                    <label title={OUTSIDE_CHECK_TIP}>
                      <input data-hotkey="outside-check" data-hotkey-label="Outside check" type="checkbox" checked={settings.outsideCheck !== false} onChange={event => setSettings(previous => ({ ...previous, outsideCheck: event.target.checked }))} />
                      Outside check
                    </label>
                    {provider.spendLimit && (
                      <label title="Optional. A prompt stops once it has cost about this much on your API key; progress is kept. Works for Anthropic models with known prices. Leave empty for no limit.">
                        Spending limit per prompt ($)
                        <input
                          type="number"
                          min="0"
                          step="1"
                          placeholder="No limit"
                          data-hotkey="spend-limit" data-hotkey-label="Spending limit per prompt" value={settings.spendLimit || ''}
                          onChange={event => setSettings(previous => ({ ...previous, spendLimit: event.target.value }))}
                        />
                      </label>
                    )}
                    {provider.stepLimit && (
                      <label title="Optional. A prompt stops after this many AI steps (each look, edit or check is a step); progress is kept. Leave empty for the usual maximum.">
                        Step limit per prompt
                        <input
                          type="number"
                          min="0"
                          step="1"
                          placeholder="Default"
                          data-hotkey="step-limit" data-hotkey-label="Step limit per prompt" value={settings.stepLimit || ''}
                          onChange={event => setSettings(previous => ({ ...previous, stepLimit: event.target.value }))}
                        />
                      </label>
                    )}
                    <label title="Deletes the AI chats, notes and leftover files of models you have not used for this many days, so they do not pile up when models are moved or edited elsewhere. Important models are kept. Leave empty to never clean up.">
                      Clean up unused chats after (days)
                      <input
                        type="number"
                        min="0"
                        step="1"
                        placeholder="Never"
                        data-hotkey="cleanup-days" data-hotkey-label="Clean up unused chats after" value={settings.cleanupDays || ''}
                        onChange={event => setSettings(previous => ({ ...previous, cleanupDays: event.target.value }))}
                      />
                    </label>
                    <div className="ai-row">
                      <button
                        disabled={anyBusy || authBusy}
                        title="Save these settings." data-hotkey="save-connection" data-hotkey-label="Save connection"
                        onClick={() =>
                          action(async () => {
                            await saveSettings();
                            setStatus('Connection saved.');
                          })
                        }
                      >
                        Save connection
                      </button>
                      <button
                        disabled={anyBusy || authBusy}
                        title="Get the list of available models." data-hotkey="load-models" data-hotkey-label="Load models"
                        onClick={loadModels}
                      >
                        Load models
                      </button>
                    </div>
                    {native && (
                      <details>
                        <summary title="Where the AI program is installed." data-hotkey="advanced:expand" data-hotkey-label="Advanced connection">Advanced connection</summary>
                        <label title="Path to the Codex or Claude program.">
                          CLI executable (optional)
                          <input
                            data-hotkey="executable" data-hotkey-label="CLI executable" value={settings.executable || ''}
                            disabled={anyBusy || authBusy}
                            placeholder={settings.provider + '.exe'}
                            onChange={event =>
                              setSettings(previous => ({ ...previous, executable: event.target.value }))
                            }
                          />
                        </label>
                      </details>
                    )}
  </>);
}
