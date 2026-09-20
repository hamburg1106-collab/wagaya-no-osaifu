/** プライベートブラウズ等でlocalStorageが落ちるので、必ずtry/catchで包む */
export const readStorage = (key: string): string | null => {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

export const writeStorage = (key: string, value: string): void => {
  try {
    localStorage.setItem(key, value)
  } catch {
    /* 保存できなくてもアプリは動かす */
  }
}

export const removeStorage = (key: string): void => {
  try {
    localStorage.removeItem(key)
  } catch {
    /* 同上 */
  }
}
