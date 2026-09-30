'use client'

import { useEffect } from 'react'

import { setCompareSelection, type CompareItem } from '@/lib/compare-selection'

/**
 * Make the tray agree with the URL.
 *
 * /compare resolves its own query string on the server, so the page is already
 * correct without this. What it fixes is the state you carry AWAY from the
 * page: follow a shared link, click back into /discover, and without this the
 * tray would still hold whatever you had selected before -- so the compare bar
 * and the comparison you were just looking at would name different tools.
 *
 * The URL wins, deliberately and in that direction only. Merging a shared link
 * into the recipient's existing selection would silently add tools they did
 * not pick to a page they did not build.
 *
 * Renders nothing. It is an effect with a component's shape because that is
 * how a server page reaches localStorage.
 */
export function CompareSync({ items }: { items: CompareItem[] }) {
  useEffect(() => {
    // Keyed on the resolved ids: setCompareSelection no-ops when the set
    // already matches, so this cannot loop, and re-running on a genuine change
    // (removing a column, which is a navigation) is exactly what we want.
    setCompareSelection(items)
  }, [items])

  return null
}
