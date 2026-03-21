import { describe, expect, it } from 'vitest'
import {
  derivePasswordEntryTitleBlock,
  findMatchingPasswordEntriesBlock,
  findPasswordSaveTargetBlock,
  hostnameFromUrlBlock,
  normalizeHostnameBlock,
  type PasswordAutofillWebContextBlock,
} from '@/services/lego_blocks/units/passwordAutofillMatchBlock'

const context: PasswordAutofillWebContextBlock = {
  url: 'https://github.com/login',
  origin: 'https://github.com',
  hostname: 'github.com',
  pageTitle: 'Sign in to GitHub · GitHub',
  usernameValue: 'octocat',
  passwordValue: 'secret',
  activeField: 'password',
  rect: null,
}

describe('passwordAutofillMatchBlock', () => {
  it('normalizes hostnames and urls', () => {
    expect(normalizeHostnameBlock('WWW.GitHub.com')).toBe('github.com')
    expect(hostnameFromUrlBlock('https://www.github.com/login')).toBe('github.com')
  })

  it('finds hostname matches and ranks exact username matches first', () => {
    const matches = findMatchingPasswordEntriesBlock([
      {
        id: '1',
        title: 'GitHub personal',
        username: 'someone-else',
        password: 'a',
        website: 'https://github.com',
        tags: [],
        createdAt: '2026-03-20T00:00:00.000Z',
        updatedAt: '2026-03-20T00:00:00.000Z',
      },
      {
        id: '2',
        title: 'GitHub work',
        username: 'octocat',
        password: 'b',
        website: 'https://github.com/login',
        tags: [],
        createdAt: '2026-03-20T00:00:00.000Z',
        updatedAt: '2026-03-21T00:00:00.000Z',
      },
      {
        id: '3',
        title: 'GitHub subdomain',
        username: 'octocat',
        password: 'c',
        website: 'https://gist.github.com',
        tags: [],
        createdAt: '2026-03-20T00:00:00.000Z',
        updatedAt: '2026-03-19T00:00:00.000Z',
      },
    ], context)

    expect(matches.map((entry) => entry.id)).toEqual(['2', '1', '3'])
  })

  it('picks an existing save target when hostname and username match', () => {
    const target = findPasswordSaveTargetBlock([
      {
        id: '1',
        title: 'GitHub work',
        username: 'octocat',
        password: 'b',
        website: 'https://github.com/login',
        tags: [],
        createdAt: '2026-03-20T00:00:00.000Z',
        updatedAt: '2026-03-21T00:00:00.000Z',
      },
      {
        id: '2',
        title: 'GitHub personal',
        username: 'other',
        password: 'c',
        website: 'https://github.com',
        tags: [],
        createdAt: '2026-03-20T00:00:00.000Z',
        updatedAt: '2026-03-20T00:00:00.000Z',
      },
    ], context)

    expect(target?.id).toBe('1')
  })

  it('derives a clean title from page title', () => {
    expect(derivePasswordEntryTitleBlock('Sign in to GitHub · GitHub', 'github.com')).toBe('Sign in to GitHub')
  })
})
