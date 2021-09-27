let realAtob: (b64Str: string) => string

const b64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/='
const b64re =
  /^(?:[A-Za-z\d+/]{4})*?(?:[A-Za-z\d+/]{2}(?:==)?|[A-Za-z\d+/]{3}=?)?$/

if (typeof atob !== 'function') {
  realAtob = function (str: string) {
    str = String(str).replace(/[\t\n\f\r ]+/g, '')
    if (!b64re.test(str)) {
      throw new Error(
        "Failed to execute 'atob' on 'Window': The string to be decoded is not correctly encoded."
      )
    }

    // Adding the padding if missing, for semplicity
    str += '=='.slice(2 - (str.length & 3))
    var bitmap
    var result = ''
    var r1
    var r2
    var i = 0
    for (; i < str.length; ) {
      bitmap =
        (b64.indexOf(str.charAt(i++)) << 18) |
        (b64.indexOf(str.charAt(i++)) << 12) |
        ((r1 = b64.indexOf(str.charAt(i++))) << 6) |
        (r2 = b64.indexOf(str.charAt(i++)))

      result +=
        r1 === 64
          ? String.fromCharCode((bitmap >> 16) & 255)
          : r2 === 64
          ? String.fromCharCode((bitmap >> 16) & 255, (bitmap >> 8) & 255)
          : String.fromCharCode(
              (bitmap >> 16) & 255,
              (bitmap >> 8) & 255,
              bitmap & 255
            )
    }
    return result
  }
} else {
  // 注意atob只能在全局对象上调用，例如：`const Base64 = {atob};Base64.atob('xxxx')`是错误的用法
  realAtob = atob
}

function b64DecodeUnicode(str: string): string {
  return decodeURIComponent(
    realAtob(str)
      .split('')
      .map(function (c) {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)
      })
      .join('')
  )
}

interface UniIdUserInfo {
  uid: null | string
  role: Array<string>
  permission: Array<string>
  tokenExpired: number
}

function getCurrentUserInfo(): UniIdUserInfo {
  const token = uni.getStorageSync('uni_id_token') || ''
  const tokenArr = token.split('.')
  if (!token || tokenArr.length !== 3) {
    return {
      uid: null,
      role: [],
      permission: [],
      tokenExpired: 0,
    }
  }
  let userInfo
  try {
    userInfo = JSON.parse(b64DecodeUnicode(tokenArr[1]))
  } catch (error: any) {
    throw new Error('获取当前用户信息出错，详细错误信息为：' + error.message)
  }
  userInfo.tokenExpired = userInfo.exp * 1000
  delete userInfo.exp
  delete userInfo.iat
  return userInfo
}

export function uniIdMixin(globalProperties: Record<string, any>): void {
  globalProperties.uniIDHasRole = function (roleId: string): boolean {
    const { role } = getCurrentUserInfo()
    return role.indexOf(roleId) > -1
  }
  globalProperties.uniIDHasPermission = function (
    permissionId: string
  ): boolean {
    const { permission } = getCurrentUserInfo()
    return this.uniIDHasRole('admin') || permission.indexOf(permissionId) > -1
  }
  globalProperties.uniIDTokenValid = function (): boolean {
    const { tokenExpired } = getCurrentUserInfo()
    return tokenExpired > Date.now()
  }
}
