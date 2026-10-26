import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { KeyRound, Plus, Power, ShieldCheck, ShieldPlus, Trash2 } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { api, ApiError, asData } from '../lib/api';
import { useApi } from '../hooks/useApi';
import type { Id, User } from '../types';
import { date, initials } from '../lib/format';
import { listOf } from '../lib/data';
import { Badge, Button, ErrorState, FormActions, Input, LoadingState, Modal, PageHeader, Panel, SearchField, Select } from '../components/ui';
import { DataTable } from '../components/DataTable';
import { useToast } from '../contexts/ToastContext';
import { useAuth } from '../contexts/AuthContext';

const userSchema = z.object({
  username: z.string().trim().min(3, 'Le pseudo doit contenir au moins 3 caractères.').max(50).regex(/^[\p{L}\p{N}_. -]+$/u, 'Lettres, chiffres, espaces, point, tiret ou soulignement uniquement.'),
  displayName: z.string().trim().min(2, 'Le nom affiché est obligatoire.').max(100),
  password: z.string().min(12, '12 caractères minimum.'),
  roleId: z.string().min(1, 'Choisissez un rôle.'),
});
type UserForm = z.infer<typeof userSchema>;

interface Permission {
  id?: Id;
  code: string;
  label?: string;
  description: string;
}

interface PermissionRow extends Permission {
  roleGranted: boolean;
  overrideEffect: 'allow' | 'deny' | null;
  effective: boolean;
}

interface Role {
  id: Id;
  code: string;
  label: string;
  isSystem: boolean;
  userCount: number;
  permissionCodes: string[];
  permissions?: Permission[];
}

function roleCodes(role?: Role | null) {
  return role?.permissionCodes || role?.permissions?.map((permission) => permission.code) || [];
}

export function UsersPage() {
  const [search, setSearch] = useState('');
  const [creating, setCreating] = useState(false);
  const [permissionsUser, setPermissionsUser] = useState<User | null>(null);
  const [permissionRows, setPermissionRows] = useState<PermissionRow[]>([]);
  const [permissionsLoading, setPermissionsLoading] = useState(false);
  const [permissionsSaving, setPermissionsSaving] = useState(false);
  const [roleManagerOpen, setRoleManagerOpen] = useState(false);
  const [roleDraftId, setRoleDraftId] = useState('new');
  const [roleLabel, setRoleLabel] = useState('');
  const [rolePermissions, setRolePermissions] = useState<Set<string>>(new Set());
  const [roleSaving, setRoleSaving] = useState(false);

  const usersQuery = useApi<any>('/users', { search, pageSize: 100 });
  const rolesQuery = useApi<Role[]>('/roles');
  const permissionQuery = useApi<Permission[]>('/roles/permissions');
  const users = useMemo(() => listOf<User>(usersQuery.data), [usersQuery.data]);
  const roles = useMemo(() => listOf<Role>(rolesQuery.data), [rolesQuery.data]);
  const permissions = useMemo(() => listOf<Permission>(permissionQuery.data), [permissionQuery.data]);
  const selectedRole = roles.find((role) => String(role.id) === roleDraftId);
  const { notify } = useToast();
  const { can, user: current } = useAuth();
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<UserForm>({
    resolver: zodResolver(userSchema),
    defaultValues: { username: '', displayName: '', password: '', roleId: '' },
  });

  useEffect(() => {
    if (!roleManagerOpen || roleDraftId === 'new') return;
    const role = roles.find((candidate) => String(candidate.id) === roleDraftId);
    if (role) { setRoleLabel(role.label); setRolePermissions(new Set(roleCodes(role))); }
  }, [roleDraftId, roleManagerOpen, roles]);

  function selectRole(role: Role | null) {
    setRoleDraftId(role ? String(role.id) : 'new');
    setRoleLabel(role?.label ?? '');
    setRolePermissions(new Set(roleCodes(role)));
  }

  function openCreate() {
    reset({ username: '', displayName: '', password: '', roleId: String(roles[0]?.id ?? '') });
    setCreating(true);
  }

  async function createUser(values: UserForm) {
    try {
      await api.post('/users', { ...values });
      notify('Compte utilisateur créé.');
      setCreating(false); reset(); usersQuery.reload(); rolesQuery.reload();
    } catch (reason) { notify(reason instanceof ApiError ? reason.message : 'Création impossible.', 'error'); }
  }

  async function toggleUser(user: User) {
    if (String(user.id) === String(current?.id)) { notify('Vous ne pouvez pas désactiver votre propre compte.', 'error'); return; }
    if (!window.confirm(`${user.enabled === false ? 'Réactiver' : 'Désactiver'} le compte de ${user.displayName} ?`)) return;
    try {
      await api.patch(`/users/${user.id}/status`, { isActive: user.enabled === false });
      notify('État du compte mis à jour.'); usersQuery.reload();
    } catch (reason) { notify(reason instanceof ApiError ? reason.message : 'Mise à jour impossible.', 'error'); }
  }

  async function changeRole(user: User, roleId: string) {
    try {
      await api.patch(`/users/${user.id}/role`, { roleId });
      notify(`Rôle de ${user.displayName} mis à jour.`); usersQuery.reload(); rolesQuery.reload();
    } catch (reason) { notify(reason instanceof ApiError ? reason.message : 'Changement de rôle impossible.', 'error'); }
  }

  async function openPermissions(user: User) {
    setPermissionsUser(user); setPermissionsLoading(true);
    try {
      const response = await api.get<any>(`/users/${user.id}/permissions`);
      setPermissionRows(asData<PermissionRow[]>(response));
    } catch (reason) {
      notify(reason instanceof ApiError ? reason.message : 'Permissions indisponibles.', 'error'); setPermissionsUser(null);
    } finally { setPermissionsLoading(false); }
  }

  function setPermission(code: string, effect: 'allow' | 'deny' | 'inherit') {
    setPermissionRows((rows) => rows.map((row) => row.code === code ? {
      ...row,
      overrideEffect: effect === 'inherit' ? null : effect,
      effective: effect === 'allow' || (effect === 'inherit' && row.roleGranted),
    } : row));
  }

  async function savePermissions() {
    if (!permissionsUser) return;
    setPermissionsSaving(true);
    try {
      await api.put(`/users/${permissionsUser.id}/permissions`, { overrides: permissionRows.map((row) => ({ code: row.code, effect: row.overrideEffect || 'inherit' })) });
      notify('Permissions mises à jour.'); setPermissionsUser(null);
    } catch (reason) { notify(reason instanceof ApiError ? reason.message : 'Mise à jour impossible.', 'error'); }
    finally { setPermissionsSaving(false); }
  }

  function toggleRolePermission(code: string) {
    setRolePermissions((current) => { const next = new Set(current); if (next.has(code)) next.delete(code); else next.add(code); return next; });
  }

  async function saveRole(event: FormEvent) {
    event.preventDefault();
    const label = roleLabel.trim();
    if (label.length < 2) { notify('Le nom du rôle doit contenir au moins 2 caractères.', 'error'); return; }
    setRoleSaving(true);
    try {
      const body = { label, permissionCodes: [...rolePermissions] };
      const response = roleDraftId === 'new' ? await api.post<any>('/roles', body) : await api.put<any>(`/roles/${roleDraftId}`, body);
      const saved = asData<Role>(response);
      notify(roleDraftId === 'new' ? 'Rôle créé.' : 'Rôle mis à jour.');
      if (saved?.id) setRoleDraftId(String(saved.id));
      rolesQuery.reload(); usersQuery.reload();
    } catch (reason) { notify(reason instanceof ApiError ? reason.message : 'Enregistrement du rôle impossible.', 'error'); }
    finally { setRoleSaving(false); }
  }

  async function deleteRole() {
    if (!selectedRole || selectedRole.isSystem || selectedRole.userCount > 0) return;
    if (!window.confirm(`Supprimer le rôle « ${selectedRole.label} » ?`)) return;
    try {
      await api.delete(`/roles/${selectedRole.id}`); notify('Rôle supprimé.'); selectRole(null); rolesQuery.reload();
    } catch (reason) { notify(reason instanceof ApiError ? reason.message : 'Suppression impossible.', 'error'); }
  }

  return <div className="animate-enter">
    <PageHeader eyebrow="Contrôle d’accès" title="Utilisateurs & permissions" description="Créez les pseudos, composez vos propres rôles et attribuez uniquement les droits nécessaires." action={<div className="flex flex-wrap gap-2">{can('users.permissions') && <Button variant="secondary" onClick={() => { setRoleManagerOpen(true); selectRole(roles[0] ?? null); }}><ShieldPlus className="h-4 w-4" />Gérer les rôles</Button>}{can('users.create') && <Button onClick={openCreate}><Plus className="h-4 w-4" />Nouvel utilisateur</Button>}</div>} />

    <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{roles.map((role) => <Panel key={role.id} className="p-4"><p className="label">{role.label}</p><p className="text-2xl font-bold">{role.userCount ?? 0}</p></Panel>)}</div>

    <Panel className="overflow-hidden"><div className="border-b border-white/[.07] p-4"><SearchField value={search} onChange={setSearch} placeholder="Nom ou pseudo…" /></div>{usersQuery.loading ? <LoadingState /> : usersQuery.error ? <ErrorState message={usersQuery.error} retry={usersQuery.reload} /> : <DataTable<User> rows={users} rowKey={(user) => user.id} columns={[
      { key: 'user', label: 'Utilisateur', render: (user) => <div className="flex items-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-xl bg-blood-600/15 text-xs font-bold text-white">{initials(user.displayName)}</span><div><p className="font-semibold text-zinc-200">{user.displayName}</p><p className="text-[11px] text-zinc-600">@{user.username || user.id}</p></div></div> },
      { key: 'role', label: 'Rôle', render: (user) => can('users.update') ? <Select aria-label={`Rôle de ${user.displayName}`} value={String(user.roleId ?? roles.find((role) => role.label === user.role)?.id ?? '')} onChange={(event) => void changeRole(user, event.target.value)} className="min-w-40"><option value="" disabled>Choisir…</option>{roles.map((role) => <option key={role.id} value={role.id}>{role.label}</option>)}</Select> : <Badge tone={user.role === 'Patron' ? 'danger' : 'info'}>{user.role}</Badge> },
      { key: 'permissions', label: 'Permissions', render: () => <span className="text-xs text-zinc-500">Rôle + exceptions individuelles</span> },
      { key: 'login', label: 'Dernière connexion', render: (user) => <span className="text-xs text-zinc-500">{date(user.lastLoginAt, true)}</span> },
      { key: 'state', label: 'Compte', render: (user) => <Badge tone={user.enabled === false ? 'danger' : 'success'}>{user.enabled === false ? 'Désactivé' : 'Actif'}</Badge> },
      { key: 'actions', label: '', render: (user) => <div className="flex justify-end gap-1">{can('users.permissions') && <Button variant="ghost" size="sm" onClick={() => void openPermissions(user)}><KeyRound className="h-4 w-4" />Droits</Button>}{can('users.update') && <Button variant="ghost" size="sm" aria-label={user.enabled === false ? 'Réactiver' : 'Désactiver'} onClick={() => void toggleUser(user)}><Power className="h-4 w-4" /></Button>}</div> },
    ]} />}</Panel>

    <Modal open={creating} onClose={() => setCreating(false)} title="Nouvel utilisateur" description="Le pseudo servira d’identifiant de connexion."><form onSubmit={handleSubmit(createUser)} className="p-5"><div className="space-y-4"><Input label="Pseudo" autoComplete="off" {...register('username')} error={errors.username?.message} /><Input label="Nom affiché" {...register('displayName')} error={errors.displayName?.message} /><Input label="Mot de passe initial" type="password" autoComplete="new-password" {...register('password')} error={errors.password?.message} /><Select label="Rôle" {...register('roleId')} error={errors.roleId?.message}><option value="">Sélectionner…</option>{roles.map((role) => <option key={role.id} value={role.id}>{role.label}</option>)}</Select></div><FormActions cancel={() => setCreating(false)} submitting={isSubmitting} submitLabel="Créer le compte" /></form></Modal>

    <Modal open={!!permissionsUser} onClose={() => setPermissionsUser(null)} title={`Droits — ${permissionsUser?.displayName || ''}`} description="Les libellés décrivent directement ce que chaque droit autorise." size="lg"><form onSubmit={(event) => { event.preventDefault(); void savePermissions(); }} className="p-5"><div className="mb-4 flex items-center gap-3 rounded-xl border border-white/[.07] bg-white/[.025] p-4"><ShieldCheck className="h-6 w-6 text-blood-400" /><div><p className="font-semibold text-zinc-200">Rôle {permissionsUser?.role}</p><p className="text-xs text-zinc-600">« Hériter » conserve le choix défini dans le rôle.</p></div></div>{permissionsLoading ? <LoadingState /> : <div className="space-y-2">{permissionRows.map((permission) => <div key={permission.code} className="grid gap-3 rounded-xl border border-white/[.06] bg-white/[.02] p-3 sm:grid-cols-[minmax(0,1fr)_150px] sm:items-center"><div><div className="flex flex-wrap items-center gap-2"><p className="text-sm font-medium text-zinc-200">{permission.description}</p><Badge tone={permission.effective ? 'success' : 'neutral'}>{permission.effective ? 'Autorisé' : 'Refusé'}</Badge></div>{permission.roleGranted && <p className="mt-1 text-xs text-zinc-600">Accordé par le rôle</p>}</div><Select aria-label={`Choix pour ${permission.description}`} value={permission.overrideEffect || 'inherit'} onChange={(event) => setPermission(permission.code, event.target.value as 'allow' | 'deny' | 'inherit')}><option value="inherit">Hériter du rôle</option><option value="allow">Autoriser</option><option value="deny">Refuser</option></Select></div>)}</div>}<FormActions cancel={() => setPermissionsUser(null)} submitting={permissionsSaving} submitLabel="Enregistrer les droits" /></form></Modal>

    <Modal open={roleManagerOpen} onClose={() => setRoleManagerOpen(false)} title="Gérer les rôles" description="Créez un rôle puis cochez directement ce que ses utilisateurs pourront faire." size="xl"><form onSubmit={saveRole} className="p-5"><div className="grid gap-5 md:grid-cols-[230px_minmax(0,1fr)]"><aside className="space-y-2 border-b border-white/[.07] pb-5 md:border-b-0 md:border-r md:pb-0 md:pr-5"><Button type="button" variant={roleDraftId === 'new' ? 'primary' : 'secondary'} className="w-full" onClick={() => selectRole(null)}><Plus className="h-4 w-4" />Nouveau rôle</Button>{roles.map((role) => <button key={role.id} type="button" onClick={() => selectRole(role)} className={`w-full rounded-xl border p-3 text-left transition ${roleDraftId === String(role.id) ? 'border-blood-500/40 bg-blood-500/10' : 'border-white/[.06] bg-white/[.02] hover:bg-white/[.05]'}`}><span className="block text-sm font-semibold text-zinc-200">{role.label}</span><span className="mt-1 block text-xs text-zinc-600">{role.userCount || 0} utilisateur(s)</span></button>)}</aside><div><div className="mb-5 flex flex-wrap items-end gap-3"><Input label="Nom du rôle" value={roleLabel} onChange={(event) => setRoleLabel(event.target.value)} maxLength={100} className="min-w-0 flex-1" />{selectedRole && !selectedRole.isSystem && <Button type="button" variant="danger" size="sm" disabled={selectedRole.userCount > 0} title={selectedRole.userCount > 0 ? 'Réattribuez d’abord les utilisateurs.' : undefined} onClick={() => void deleteRole()}><Trash2 className="h-4 w-4" />Supprimer</Button>}</div><h3 className="mb-3 text-sm font-semibold text-zinc-200">Droits du rôle</h3>{permissionQuery.loading ? <LoadingState /> : permissionQuery.error ? <ErrorState message={permissionQuery.error} retry={permissionQuery.reload} /> : <div className="grid gap-2 sm:grid-cols-2">{permissions.map((permission) => <label key={permission.code} className="flex cursor-pointer items-start gap-3 rounded-xl border border-white/[.06] bg-white/[.02] p-3 transition hover:bg-white/[.05]"><input type="checkbox" className="mt-0.5 h-4 w-4 shrink-0 accent-blood-600" checked={rolePermissions.has(permission.code)} onChange={() => toggleRolePermission(permission.code)} /><span><span className="block text-sm font-medium text-zinc-200">{permission.label || permission.description}</span>{permission.label && permission.label !== permission.description && <span className="mt-1 block text-xs text-zinc-600">{permission.description}</span>}</span></label>)}</div>}</div></div><FormActions cancel={() => setRoleManagerOpen(false)} submitting={roleSaving} submitLabel={roleDraftId === 'new' ? 'Créer le rôle' : 'Enregistrer le rôle'} /></form></Modal>
  </div>;
}
