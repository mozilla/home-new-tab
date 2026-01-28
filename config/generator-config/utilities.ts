import * as fs from 'fs'
import * as path from 'path'

export interface ComponentStructure {
  main: string
  sub: string | null
  hasSiblings: boolean
  hasParent: boolean
  siblings: string[]
}

export function detectComponentStructure(
  input: string,
  componentsPath: string
): ComponentStructure {
  // If no hyphen, it's a main component
  if (!input.includes('-')) {
    return {
      main: input,
      sub: null,
      hasSiblings: false,
      hasParent: false,
      siblings: []
    }
  }

  // Split on first hyphen only
  const firstHyphenIndex = input.indexOf('-')
  const prefix = input.substring(0, firstHyphenIndex)
  const suffix = input.substring(firstHyphenIndex + 1)

  // Check if parent folder exists
  const parentPath = path.join(componentsPath, prefix)
  const hasParent = fs.existsSync(parentPath) && fs.statSync(parentPath).isDirectory()

  // Get all component folders
  let allComponents: string[] = []
  if (fs.existsSync(componentsPath)) {
    allComponents = fs.readdirSync(componentsPath, { withFileTypes: true })
      .filter(dirent => dirent.isDirectory())
      .map(dirent => dirent.name)
      .filter(name => !name.startsWith('.') && !name.startsWith('_'))
  }

  // Find siblings with same prefix (excluding current input)
  const siblings = allComponents.filter(name =>
    name !== input && name.startsWith(prefix + '-')
  )

  const hasSiblings = siblings.length > 0

  return {
    main: prefix,
    sub: suffix,
    hasSiblings,
    hasParent,
    siblings
  }
}

export function validateFilename(input: string) {
  if (input.includes(".")) return "name cannot include an extension"
  if (input.includes("_")) return "name cannot include underscores"
  if (!input) return "name is required"

  return true
}
