import React, { useEffect, useRef, useState } from 'react';
import { booleanFields, textFields } from '../shared/capsule-fields.js';
import { Brand } from './Brand.jsx';

const inputs = {
  prompt_version: { placeholder: 'e.g. v1' },
  category: { list: 'categories' },
  prompt_text: { rows: 6 },
  response_summary: { rows: 3 },
  usefulness: { list: 'ratings' },
  screenshot_url: { type: 'url' },
  notes: { rows: 3 },
};
const fields = Object.fromEntries(Object.entries(textFields).map(([name, field]) => [name, { ...field, ...inputs[name] }]));
const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' });

async function request(path, options) {
  const response = await fetch(`/api${path}`, options);
  if (response.status === 204) return;
  if (response.status === 401) {
    window.location.assign('/?sign_in=required');
    throw new Error('Sign in again to continue.');
  }
  const data = await response.json().catch(() => null);
  if (!response.ok || data === null) throw new Error(data?.error || 'The server could not complete the request.');
  return data;
}

function useDialog() {
  const dialog = useRef(null);
  useEffect(() => {
    const element = dialog.current;
    element.showModal();
    return () => element.close();
  }, []);
  return dialog;
}

function Dialog({ title, description, onClose, busy = false, children, narrow = false }) {
  const dialog = useDialog();
  return (
    <dialog ref={dialog} className={narrow ? 'dialog-narrow' : undefined} aria-labelledby="dialog-title" onCancel={event => {
      event.preventDefault();
      if (!busy) onClose();
    }}>
      <div className="dialog-header">
        <div><h2 id="dialog-title">{title}</h2>{description && <p>{description}</p>}</div>
        <button type="button" className="close-button" aria-label="Close" onClick={onClose} disabled={busy}>×</button>
      </div>
      {children}
    </dialog>
  );
}

function CapsuleEditor({ capsule, onSave, onClose }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const values = Object.fromEntries(Object.keys(fields).map(name => [name, form.get(name)]));
    for (const name of Object.keys(booleanFields)) values[name] = form.has(name);
    setBusy(true);
    setError('');
    try {
      await onSave(values, capsule);
    } catch (failure) {
      setError(failure.message);
      setBusy(false);
    }
  }

  return (
    <Dialog title={capsule ? 'Edit capsule' : 'New capsule'} description="Project name, prompt title and prompt text are required." onClose={onClose} busy={busy}>
      <form onSubmit={submit}>
        <div className="dialog-body form-grid">
          {Object.entries(fields).map(([name, { label, rows, ...props }]) => (
            <label key={name} className={rows || name === 'screenshot_url' ? 'field field-full' : 'field'}>
              <span>{label}{props.required && <span className="required" aria-hidden="true"> *</span>}</span>
              {rows ? <textarea name={name} rows={rows} defaultValue={capsule?.[name]} {...props} /> :
                <input name={name} defaultValue={capsule?.[name]} {...props} />}
            </label>
          ))}
          <datalist id="categories"><option value="Coding" /><option value="Writing" /><option value="Research" /><option value="Study" /></datalist>
          <datalist id="ratings"><option value="Good" /><option value="Needs improvement" /></datalist>
          <fieldset className="flags field-full">
            <legend>Review status</legend>
            {Object.entries(booleanFields).map(([name, label]) => (
              <label key={name}><input type="checkbox" name={name} defaultChecked={capsule?.[name]} />{label}</label>
            ))}
          </fieldset>
          {error && <p className="notice field-full" role="alert">{error}</p>}
        </div>
        <div className="dialog-actions">
          <button type="button" className="button button-outline" onClick={onClose} disabled={busy}>Cancel</button>
          <button type="submit" className="button button-primary" disabled={busy}>{busy ? 'Saving…' : 'Save capsule'}</button>
        </div>
      </form>
    </Dialog>
  );
}

function CapsuleDetail({ capsule, onEdit, onClose }) {
  return (
    <Dialog title={capsule.prompt_title} description={capsule.project_name} onClose={onClose}>
      <dl className="dialog-body detail-grid">
        {Object.entries(fields).filter(([name]) => !['prompt_title', 'project_name'].includes(name)).map(([name, { label, rows }]) => (
          <div key={name} className={rows || name === 'screenshot_url' ? 'field-full' : undefined}>
            <dt>{label}</dt>
            <dd>{name === 'screenshot_url' && capsule[name] ?
              <a className="text-link" href={capsule[name]} target="_blank" rel="noopener noreferrer">Open screenshot</a> : capsule[name] || '—'}</dd>
          </div>
        ))}
        {Object.entries(booleanFields).map(([name, label]) => <div key={name}><dt>{label}</dt><dd>{capsule[name] ? 'Yes' : 'No'}</dd></div>)}
        <div><dt>Created</dt><dd>{dateFormat.format(new Date(capsule.created_at))}</dd></div>
      </dl>
      <div className="dialog-actions"><button type="button" className="button button-primary" onClick={() => onEdit(capsule)}>Edit capsule</button></div>
    </Dialog>
  );
}

function DeleteCapsule({ capsule, onRemove, onClose }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function remove() {
    setBusy(true);
    setError('');
    try {
      await onRemove(capsule);
    } catch (failure) {
      setError(failure.message);
      setBusy(false);
    }
  }

  return (
    <Dialog title="Delete capsule?" onClose={onClose} busy={busy} narrow>
      <div className="dialog-body">
        <p>“{capsule.prompt_title}” will be permanently removed from your library.</p>
        {error && <p className="notice" role="alert">{error}</p>}
      </div>
      <div className="dialog-actions">
        <button type="button" className="button button-outline" onClick={onClose} disabled={busy}>Cancel</button>
        <button type="button" className="button button-danger" onClick={remove} disabled={busy}>{busy ? 'Deleting…' : 'Delete capsule'}</button>
      </div>
    </Dialog>
  );
}

function CapsuleCard({ capsule, onOpen }) {
  return (
    <li className="capsule-card">
      <div className="card-tags">
        <span className="tag">{capsule.category || 'Uncategorized'}</span>
        {capsule.prompt_version && <span className="tag">{capsule.prompt_version}</span>}
      </div>
      <p className="card-project">{capsule.project_name}</p>
      <h3><button type="button" className="card-title" onClick={() => onOpen('detail', capsule)}>{capsule.prompt_title}</button></h3>
      <p className="card-prompt">{capsule.prompt_text}</p>
      <p className="card-status">{capsule.reviewed ? 'Reviewed' : 'To review'}{capsule.improved && ' · Improved'}</p>
      <div className="card-actions">
        <time dateTime={capsule.created_at}>{dateFormat.format(new Date(capsule.created_at))}</time>
        <button type="button" className="text-button" onClick={() => onOpen('edit', capsule)} aria-label={`Edit ${capsule.prompt_title}`}>Edit</button>
        <button type="button" className="text-button text-danger" onClick={() => onOpen('delete', capsule)} aria-label={`Delete ${capsule.prompt_title}`}>Delete</button>
      </div>
    </li>
  );
}

export function Dashboard() {
  const [data, setData] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [retry, setRetry] = useState(0);
  const [panel, setPanel] = useState(null);
  const [notice, setNotice] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    const options = { signal: controller.signal };
    Promise.all([request('/session', options), request('/capsules', options)])
      .then(([session, capsules]) => setData({ session, capsules }))
      .catch(error => { if (!controller.signal.aborted) setLoadError(error.message); });
    return () => controller.abort();
  }, [retry]);

  function openPanel(mode, capsule) {
    setPanel({ mode, capsule });
    setNotice('');
  }

  async function save(values, capsule) {
    const saved = await request(capsule ? `/capsules/${capsule.id}` : '/capsules', {
      method: capsule ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(values),
    });
    setData(current => ({ ...current, capsules: capsule ?
      current.capsules.map(item => item.id === saved.id ? saved : item) : [saved, ...current.capsules] }));
    setPanel(null);
    setNotice(capsule ? 'Capsule updated.' : 'Capsule saved.');
  }

  async function remove(capsule) {
    await request(`/capsules/${capsule.id}`, { method: 'DELETE' });
    setData(current => ({ ...current, capsules: current.capsules.filter(item => item.id !== capsule.id) }));
    setPanel(null);
    setNotice('Capsule deleted.');
  }

  const closePanel = () => setPanel(null);
  const capsules = data?.capsules;

  return (
    <>
      <header className="topbar"><nav className="container nav" aria-label="Main">
        <Brand />
        <div className="nav-actions">
          {data && <span className="account">@{data.session.login}</span>}
          <form method="post" action="/logout"><button className="button button-outline" type="submit">Sign out</button></form>
        </div>
      </nav></header>
      <main className="container dashboard">
        <section className="dashboard-intro" aria-labelledby="dashboard-title">
          <div><p className="eyebrow"><span className="privacy-dot" />Private library</p><h1 id="dashboard-title">Your prompt library.</h1><p>Save prompts, review responses and keep track of improvements.</p></div>
          {capsules && <button className="button button-primary" type="button" onClick={() => openPanel('edit')}><span aria-hidden="true">+</span> New capsule</button>}
        </section>
        <section className="library" aria-labelledby="library-title">
          <div className="library-heading"><h2 id="library-title">Capsules</h2>{capsules && <span className="count">{capsules.length}</span>}</div>
          <p className="feedback" role="status">{notice}</p>
          {loadError ? <div className="empty-state"><p role="alert">{loadError}</p><button className="button button-outline" onClick={() => { setLoadError(''); setRetry(retry + 1); }}>Try again</button></div> :
            !capsules ? <p className="empty-state" role="status">Loading your library…</p> :
            capsules.length ? <ul className="card-grid">{capsules.map(capsule => <CapsuleCard key={capsule.id} capsule={capsule} onOpen={openPanel} />)}</ul> :
            <div className="empty-state"><span className="empty-icon" aria-hidden="true"><span className="brand-mark" /></span><h3>No capsules yet</h3><p>Save your first prompt using New capsule.</p></div>}
        </section>
      </main>
      {panel?.mode === 'edit' && <CapsuleEditor capsule={panel.capsule} onSave={save} onClose={closePanel} />}
      {panel?.mode === 'detail' && <CapsuleDetail capsule={panel.capsule} onEdit={capsule => openPanel('edit', capsule)} onClose={closePanel} />}
      {panel?.mode === 'delete' && <DeleteCapsule capsule={panel.capsule} onRemove={remove} onClose={closePanel} />}
    </>
  );
}
