import {
  ADMIN_ACCIONES_AUDIOVISUAL,
  type AdminAccion,
  type ProyectoAccesoConfig,
  type ProyectoAccesoNivel,
} from '../api/administradores'
import { esProyectoAudiovisual } from '../api/proyectos'

export type CapabilityMode = 'none' | 'view' | 'manage'

type AccesoLike = {
  nivel: ProyectoAccesoNivel | 'view' | 'manage' | 'custom'
  acciones?: readonly string[]
  visualizar?: readonly string[]
  rol?: 'admin' | 'vendedor'
}

/** Pestañas AV editables desde CRM, Administradores (El Genio) y detalle global. */
export const AV_STAFF_TABS = ADMIN_ACCIONES_AUDIOVISUAL

export function emptyAvStaffModes(): Record<AdminAccion, CapabilityMode> {
  const modes = {} as Record<AdminAccion, CapabilityMode>
  for (const tab of AV_STAFF_TABS) modes[tab.id] = 'none'
  modes.av_crm = 'manage'
  return modes
}

/** Une todas las claves alias del proyecto AV en un solo acceso. */
export function resolveAvAccess(
  accesos: Record<string, AccesoLike | ProyectoAccesoConfig> | null | undefined,
): ProyectoAccesoConfig | undefined {
  if (!accesos) return undefined
  let merged: ProyectoAccesoConfig | undefined
  for (const [key, value] of Object.entries(accesos)) {
    if (!esProyectoAudiovisual(key) || !value) continue
    merged = mergeAvAccess(merged, value as AccesoLike)
  }
  return merged
}

function mergeAvAccess(
  a: ProyectoAccesoConfig | undefined,
  b: AccesoLike,
): ProyectoAccesoConfig {
  const bNorm: ProyectoAccesoConfig = {
    nivel: b.nivel,
    acciones: (b.acciones || []) as AdminAccion[],
    visualizar: (b.visualizar || []) as AdminAccion[],
    ...(b.rol ? { rol: b.rol } : {}),
  }
  if (!a) return bNorm
  const rol =
    a.rol === 'admin' || b.rol === 'admin'
      ? 'admin'
      : a.rol === 'vendedor' || b.rol === 'vendedor'
        ? 'vendedor'
        : a.rol || b.rol
  if (a.nivel === 'manage' || b.nivel === 'manage') {
    return { nivel: 'manage', acciones: [], visualizar: [], ...(rol ? { rol } : {}) }
  }
  // view no debe tapar un custom más específico
  if (a.nivel === 'view' && b.nivel === 'view') {
    return { nivel: 'view', acciones: [], visualizar: [], ...(rol ? { rol } : {}) }
  }
  if (a.nivel === 'view' && b.nivel === 'custom') {
    return { ...bNorm, ...(rol ? { rol } : {}) }
  }
  if (a.nivel === 'custom' && b.nivel === 'view') {
    return { ...a, visualizar: a.visualizar || [], ...(rol ? { rol } : {}) }
  }
  const acciones = Array.from(
    new Set([...(a.acciones || []), ...(b.acciones || [])]),
  ) as AdminAccion[]
  const visualizar = Array.from(
    new Set([...(a.visualizar || []), ...(b.visualizar || [])]),
  ).filter((id) => !acciones.includes(id as AdminAccion)) as AdminAccion[]
  if (acciones.length === 0 && visualizar.length === 0) {
    return { nivel: 'view', acciones: [], visualizar: [], ...(rol ? { rol } : {}) }
  }
  return { nivel: 'custom', acciones, visualizar, ...(rol ? { rol } : {}) }
}

export function modesFromAvAccesos(
  accesos: Record<string, AccesoLike | ProyectoAccesoConfig> | null | undefined,
): Record<AdminAccion, CapabilityMode> {
  const modes = emptyAvStaffModes()
  const access = resolveAvAccess(accesos)
  if (!access) return modes
  if (access.nivel === 'manage') {
    for (const tab of AV_STAFF_TABS) modes[tab.id] = 'manage'
    return modes
  }
  if (access.nivel === 'view') {
    for (const tab of AV_STAFF_TABS) modes[tab.id] = 'view'
    modes.av_crm = 'manage'
    return modes
  }
  for (const id of access.acciones || []) {
    if (modes[id as AdminAccion] !== undefined) modes[id as AdminAccion] = 'manage'
  }
  for (const id of access.visualizar || []) {
    if (modes[id as AdminAccion] === 'none') modes[id as AdminAccion] = 'view'
  }
  modes.av_crm = 'manage'
  return modes
}

export function modesToAvAccionesVisualizar(
  modes: Partial<Record<AdminAccion, CapabilityMode>>,
): { acciones: AdminAccion[]; visualizar: AdminAccion[] } {
  const acciones: AdminAccion[] = []
  const visualizar: AdminAccion[] = []
  for (const tab of AV_STAFF_TABS) {
    const mode = tab.id === 'av_crm' ? 'manage' : modes[tab.id] ?? 'none'
    if (mode === 'manage') acciones.push(tab.id)
    else if (mode === 'view') visualizar.push(tab.id)
  }
  if (!acciones.includes('av_crm')) acciones.push('av_crm')
  return { acciones, visualizar }
}
