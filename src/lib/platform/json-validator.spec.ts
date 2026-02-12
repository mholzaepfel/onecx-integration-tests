import path from 'path'
import { PlatformConfigJsonValidator } from './json-validator'
import * as fs from 'fs'

jest.mock('fs')
jest.mock('../utils/logger')

describe('PlatformConfigJsonValidator', () => {
  let validator: PlatformConfigJsonValidator

  beforeEach(() => {
    jest.clearAllMocks()
    validator = new PlatformConfigJsonValidator()
  })

  describe('validateConfigFile', () => {
    describe('success scenarios', () => {
      it('should read config file correctly when a valid full path is provided', () => {
        const mockConfigPath = 'full/path/to/integration-tests.json'
        const mockConfig = {
          platformConfig: {
            importData: true,
            enableLogging: true,
            heartbeat: {
              enabled: true,
            },
          },
        }
        const mockSchema = {
          type: 'object',
          properties: {
            platformConfig: {
              type: 'object',
              properties: {
                importData: { type: 'boolean' },
                enableLogging: { type: 'boolean' },
                heartbeat: {
                  type: 'object',
                  properties: {
                    enabled: { type: 'boolean' },
                  },
                  required: ['enabled'],
                },
              },
            },
          },
          required: ['platformConfig'],
        }

        ;(fs.existsSync as jest.Mock).mockReturnValue(true)
        ;(fs.readFileSync as jest.Mock).mockImplementation((filePath: string) => {
          if (filePath === mockConfigPath) {
            return JSON.stringify(mockConfig)
          }
          if (filePath.endsWith('integration-tests.schema.json')) {
            return JSON.stringify(mockSchema)
          }
          return ''
        })

        const result = validator.validateConfigFile(mockConfigPath)

        expect(result.isValid).toBe(true)
        expect(result.config).toEqual(mockConfig.platformConfig)
        expect(result.errors).toBeUndefined()
        expect(fs.readFileSync).toHaveBeenCalledWith(mockConfigPath, 'utf8')
      })

      it('should find config recursively', () => {
        const mockRoot = validator.getDefaultConfigPath()
        const mockSubDir = 'folder1'
        const mockSubDirPath = path.join(mockRoot, mockSubDir)
        const expectedFilePath = path.join(mockSubDirPath, 'integration-tests.json')
        const mockConfig = {
          platformConfig: {
            importData: true,
          },
        }
        const mockSchema = {
          type: 'object',
          properties: {
            platformConfig: { type: 'object' },
          },
          required: ['platformConfig'],
        }

        ;(fs.existsSync as jest.Mock).mockImplementation((p: string) => {
          return (
            p === mockRoot ||
            p === mockSubDirPath ||
            p === expectedFilePath ||
            p.endsWith('integration-tests.schema.json')
          )
        })
        ;(fs.readdirSync as jest.Mock).mockImplementation((p: string) => {
          if (p === mockRoot) {
            return [{ name: mockSubDir, isDirectory: () => true, isFile: () => false }]
          }
          if (p === mockSubDirPath) {
            return [{ name: 'integration-tests.json', isDirectory: () => false, isFile: () => true }]
          }
          return []
        })
        ;(fs.readFileSync as jest.Mock).mockImplementation((filePath: string) => {
          if (filePath === expectedFilePath) {
            return JSON.stringify(mockConfig)
          }
          if (filePath.endsWith('integration-tests.schema.json')) {
            return JSON.stringify(mockSchema)
          }
          return ''
        })

        const result = validator.validateConfigFile()

        expect(result.isValid).toBe(true)
        expect(result.config).toEqual(mockConfig.platformConfig)
        expect(fs.readFileSync).toHaveBeenCalledWith(expectedFilePath, 'utf8')
      })
    })

    describe('validation and error scenarios', () => {
      describe('schema validation failures', () => {
        it('should fail when required platformConfig is missing', () => {
          const mockConfigPath = 'integration-tests.json'
          const invalidConfig = {
            wrongRootKey: {
              importData: true,
            },
          }

          const mockSchema = {
            type: 'object',
            properties: {
              platformConfig: { type: 'object' },
            },
            required: ['platformConfig'],
          }

          ;(fs.existsSync as jest.Mock).mockReturnValue(true)
          ;(fs.readFileSync as jest.Mock).mockImplementation((filePath: string) => {
            if (filePath === mockConfigPath) {
              return JSON.stringify(invalidConfig)
            }
            if (filePath.endsWith('integration-tests.schema.json')) {
              return JSON.stringify(mockSchema)
            }
            return ''
          })

          const result = validator.validateConfigFile(mockConfigPath)

          expect(result.isValid).toBe(false)
          expect(result.errors).toContain("root: must have required property 'platformConfig'")
        })

        it('should fail when heartbeat.interval is invalid (less than minimum)', () => {
          const mockConfigPath = 'integration-tests.json'
          const invalidConfig = {
            platformConfig: {
              heartbeat: {
                enabled: true,
                interval: 500,
              },
            },
          }

          const mockSchema = {
            type: 'object',
            properties: {
              platformConfig: {
                type: 'object',
                properties: {
                  heartbeat: {
                    type: 'object',
                    properties: {
                      interval: { type: 'number', minimum: 1000 },
                    },
                  },
                },
              },
            },
          }

          ;(fs.existsSync as jest.Mock).mockReturnValue(true)
          ;(fs.readFileSync as jest.Mock).mockImplementation((filePath: string) => {
            if (filePath === mockConfigPath) {
              return JSON.stringify(invalidConfig)
            }
            if (filePath.endsWith('integration-tests.schema.json')) {
              return JSON.stringify(mockSchema)
            }
            return ''
          })

          const result = validator.validateConfigFile(mockConfigPath)

          expect(result.isValid).toBe(false)
          expect(result.errors).toContain('/platformConfig/heartbeat/interval: must be >= 1000')
        })
      })

      describe('system and parsing errors', () => {
        it('should return error for invalid JSON syntax', () => {
          const mockPath = 'bad.integration-tests.json'
          ;(fs.existsSync as jest.Mock).mockReturnValue(true)
          ;(fs.readFileSync as jest.Mock).mockReturnValue('invalid { json')
          const result = validator.validateConfigFile(mockPath)
          expect(result.isValid).toBe(false)
          expect(result.errors?.[0]).toContain('Invalid JSON in config file')
        })

        it('should return error when no config file is found', () => {
          ;(fs.existsSync as jest.Mock).mockReturnValue(false)
          ;(fs.readdirSync as jest.Mock).mockReturnValue([])

          const result = validator.validateConfigFile()

          expect(result.isValid).toBe(false)
          expect(result.errors?.[0]).toContain('No valid config file found')
        })
      })
    })
  })
})
