import { jsonResponse } from '../_shared/utils.ts'

export function handleHealth(origin: string | null): Response {
  return jsonResponse({ status: 'ok' }, 200, origin)
}
