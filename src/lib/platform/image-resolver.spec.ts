const successMock = jest.fn()
const infoMock = jest.fn()
const warningMock = jest.fn()

jest.mock('../utils/logger', () => ({
  Logger: jest.fn().mockImplementation(() => ({
    success: successMock,
    info: infoMock,
    warn: warningMock,
  })),
  LogMessages: {
    IMAGE_VERIFY_SUCCESS: 'IMAGE_VERIFY_SUCCESS',
    IMAGE_VERIFY_FAILED: 'IMAGE_VERIFY_FAILED',
    IMAGE_PULL_START: 'IMAGE_PULL_START',

  },
}))

import { ImagePullChecker } from "./image-pull-checker"
import { ImageResolver } from "./image-resolver"
import { ContainerImageOverrideMapper } from '../utils/container-image-override-mapper'

jest.mock('../config/env', () => {
  return {
    POSTGRES: 'docker.io/library/postgres:13.4',
    KEYCLOAK: 'quay.io/keycloak/keycloak:23.0.4',
    IMPORT_MANAGER_BASE: 'docker.io/library/node:20',
    OnecxBff: {},
    OnecxService: {},
    OnecxUi: {},
  }
})


jest.mock('../utils/container-image-override-mapper', () => {
  return {
    ContainerImageOverrideMapper: {
      getServiceImageOverride: jest.fn(),
      getBffImageOverride: jest.fn(),
      getUiImageOverride: jest.fn(),
    },
  }
})

jest.mock('./image-pull-checker', () => {
  return {
    ImagePullChecker: {
      verifyImagePull: jest.fn(),
    },
  }
})

describe('ImageResolver', () => {
  let resolver: ImageResolver

  beforeEach(() => {
    jest.clearAllMocks()
    resolver = new ImageResolver()
  })

  describe('getImage()', () => {
    it('return image when verification is OK', async () => {
      (ImagePullChecker.verifyImagePull as jest.Mock).mockResolvedValue(true)

      const image = 'custom/image:1'


      const result = await resolver.getImage(image)

      expect(result).toBe(image)
      expect(ImagePullChecker.verifyImagePull).toHaveBeenCalledWith(image)
      expect(successMock).toHaveBeenCalled()

    })
    it('return default image when verification fails', async () => {
      (ImagePullChecker.verifyImagePull as jest.Mock).mockResolvedValue(false)

      const image = 'custom/image:1'


      const result = await resolver.getImage(image)

      expect(result).toBe(image)
      expect(ImagePullChecker.verifyImagePull).toHaveBeenCalledWith(image)
      expect(warningMock).toHaveBeenCalled()
      expect(infoMock).toHaveBeenCalled()
      expect(successMock).not.toHaveBeenCalled()


    })
  })

  describe('getPostgresImage()', () => {
    const overrideImage = 'my-custom-postgres:latest'
    const postgresImage = 'docker.io/library/postgres:13.4'
    it('should return override image if available and verified', async () => {
      (ImagePullChecker.verifyImagePull as jest.Mock).mockResolvedValue(true)
      const config: any = {
        platformOverrides: {
          core: {
            postgres: {
              image: overrideImage,
            },
          },
        },
      }
      const result = await resolver.getPostgresImage(config)
      expect(result).toBe(overrideImage)
      expect(ImagePullChecker.verifyImagePull).toHaveBeenCalledWith(overrideImage)
    })

    it('should return default image if override is available but not verified', async () => {
      (ImagePullChecker.verifyImagePull as jest.Mock).mockResolvedValueOnce(false)
      const config: any = {
        platformOverrides: {
          core: {
            postgres: {
              image: overrideImage,
            },
          },
        },
      }
      const result = await resolver.getPostgresImage(config)
      expect(result).toBe(postgresImage)
      expect(ImagePullChecker.verifyImagePull).toHaveBeenCalledWith(overrideImage)
      expect(warningMock).toHaveBeenCalledWith(
        'IMAGE_VERIFY_FAILED',
        `${overrideImage} -> ${postgresImage}`,
      )
    })

    it('should return default image if no override is available and verified', async () => {
      (ImagePullChecker.verifyImagePull as jest.Mock).mockResolvedValue(true)
      const config: any = {
        platformOverrides: {
          core: {},
        },
      }
      const result = await resolver.getPostgresImage(config)
      expect(result).toBe(postgresImage)
      expect(ImagePullChecker.verifyImagePull).toHaveBeenCalledWith(postgresImage)
    })

    it('should return default image if no override is available and default is not verified', async () => {
      (ImagePullChecker.verifyImagePull as jest.Mock).mockResolvedValue(false)
      const config: any = {
        platformOverrides: {
          core: {},
        },
      }
      const result = await resolver.getPostgresImage(config)
      expect(result).toBe('docker.io/library/postgres:13.4')
      expect(ImagePullChecker.verifyImagePull).toHaveBeenCalledWith('docker.io/library/postgres:13.4')
      expect(warningMock).toHaveBeenCalled()
    })
  })

  describe('getKeycloakImage()', () => {
    const overrideImage = 'my-custom-keycloak:latest'
    const keycloakImage = 'quay.io/keycloak/keycloak:23.0.4'
    it('should return override image if available and verified', async () => {
      (ImagePullChecker.verifyImagePull as jest.Mock).mockResolvedValue(true)
      const config: any = {
        platformOverrides: {
          core: {
            keycloak: {
              image: overrideImage,
            },
          },
        },
      }
      const result = await resolver.getKeycloakImage(config)
      expect(result).toBe(overrideImage)
      expect(ImagePullChecker.verifyImagePull).toHaveBeenCalledWith(overrideImage)
    })

    it('should return default image if override is available but not verified', async () => {
      (ImagePullChecker.verifyImagePull as jest.Mock).mockResolvedValueOnce(false)
      const config: any = {
        platformOverrides: {
          core: {
            keycloak: {
              image: overrideImage,
            },
          },
        },
      }
      const result = await resolver.getKeycloakImage(config)
      expect(result).toBe('quay.io/keycloak/keycloak:23.0.4')
      expect(ImagePullChecker.verifyImagePull).toHaveBeenCalledWith(overrideImage)
      expect(warningMock).toHaveBeenCalledWith(
        'IMAGE_VERIFY_FAILED',
        `${overrideImage} -> ${keycloakImage}`,
      )
    })

    it('should return default image if no override is available and verified', async () => {
      (ImagePullChecker.verifyImagePull as jest.Mock).mockResolvedValue(true)
      const config: any = {
        platformOverrides: {
          core: {},
        },
      }
      const result = await resolver.getKeycloakImage(config)
      expect(result).toBe(keycloakImage)
      expect(ImagePullChecker.verifyImagePull).toHaveBeenCalledWith(keycloakImage)
    })

    it('should return default image if no override is available and default is not verified', async () => {
      (ImagePullChecker.verifyImagePull as jest.Mock).mockResolvedValue(false)
      const config: any = {
        platformOverrides: {
          core: {},
        },
      }
      const result = await resolver.getKeycloakImage(config)
      expect(result).toBe(keycloakImage)
      expect(ImagePullChecker.verifyImagePull).toHaveBeenCalledWith(keycloakImage)
      expect(warningMock).toHaveBeenCalled()
    })
  })

  describe('getImportManagerBaseImage()', () => {
    const overrideImage = 'my-custom-node:latest'
    const nodeImage = 'docker.io/library/node:20'
    it('should return override image if available and verified', async () => {
      (ImagePullChecker.verifyImagePull as jest.Mock).mockResolvedValue(true)
      const config: any = {
        platformOverrides: {
          core: {
            importmanager: {
              image: overrideImage,
            },
          },
        },
      }
      const result = await resolver.getImportManagerBaseImage(config)
      expect(result).toBe(overrideImage)
      expect(ImagePullChecker.verifyImagePull).toHaveBeenCalledWith(overrideImage)
    })

    it('should return default image if override is available but not verified', async () => {
      (ImagePullChecker.verifyImagePull as jest.Mock).mockResolvedValueOnce(false)
      const config: any = {
        platformOverrides: {
          core: {
            importmanager: {
              image: overrideImage,
            },
          },
        },
      }
      const result = await resolver.getImportManagerBaseImage(config)
      expect(result).toBe(nodeImage)
      expect(ImagePullChecker.verifyImagePull).toHaveBeenCalledWith(overrideImage)
      expect(warningMock).toHaveBeenCalledWith(
        'IMAGE_VERIFY_FAILED',
        `${overrideImage} -> ${nodeImage}`,
      )
    })

    it('should return default image if no override is available and verified', async () => {
      (ImagePullChecker.verifyImagePull as jest.Mock).mockResolvedValue(true)
      const config: any = {
        platformOverrides: {
          core: {},
        },
      }
      const result = await resolver.getImportManagerBaseImage(config)
      expect(result).toBe(nodeImage)
      expect(ImagePullChecker.verifyImagePull).toHaveBeenCalledWith(nodeImage)
    })

    it('should return default image if no override is available and default is not verified', async () => {
      (ImagePullChecker.verifyImagePull as jest.Mock).mockResolvedValue(false)
      const config: any = {
        platformOverrides: {
          core: {},
        },
      }
      const result = await resolver.getImportManagerBaseImage(config)
      expect(result).toBe(nodeImage)
      expect(ImagePullChecker.verifyImagePull).toHaveBeenCalledWith(nodeImage)
      expect(warningMock).toHaveBeenCalled()
    })
  })

  describe('getServiceImage()', () => {
    const serviceName = 'onecx/test-svc:latest'
    const config: any = { platformOverrides: { services: {} } }
    const overrideImage = 'my-custom/service:latest'

    it('should return override image if available and verified', async () => {
      (ImagePullChecker.verifyImagePull as jest.Mock).mockResolvedValue(true);
      (ContainerImageOverrideMapper.getServiceImageOverride as jest.Mock).mockReturnValue(overrideImage);

      const result = await resolver.getServiceImage(serviceName as any, config)

      expect(result).toBe(overrideImage)
      expect(ContainerImageOverrideMapper.getServiceImageOverride).toHaveBeenCalledWith(serviceName, config)
      expect(ImagePullChecker.verifyImagePull).toHaveBeenCalledWith(overrideImage)
    })

    it('should return default image if override is available but not verified', async () => {
      (ImagePullChecker.verifyImagePull as jest.Mock).mockResolvedValue(false);
      (ContainerImageOverrideMapper.getServiceImageOverride as jest.Mock).mockReturnValue(overrideImage);

      const result = await resolver.getServiceImage(serviceName as any, config)

      expect(result).toBe(serviceName)
      expect(ContainerImageOverrideMapper.getServiceImageOverride).toHaveBeenCalledWith(serviceName, config)
      expect(ImagePullChecker.verifyImagePull).toHaveBeenCalledWith(overrideImage)
      expect(warningMock).toHaveBeenCalledWith('IMAGE_VERIFY_FAILED', `${overrideImage} -> ${serviceName}`)
    })

    it('should return default image if no override is available and default is verified', async () => {
      (ImagePullChecker.verifyImagePull as jest.Mock).mockResolvedValue(true);
      (ContainerImageOverrideMapper.getServiceImageOverride as jest.Mock).mockReturnValue(undefined);

      const result = await resolver.getServiceImage(serviceName as any, config)

      expect(result).toBe(serviceName)
      expect(ContainerImageOverrideMapper.getServiceImageOverride).toHaveBeenCalledWith(serviceName, config)
      expect(ImagePullChecker.verifyImagePull).toHaveBeenCalledWith(serviceName)
    })

    it('should return default image if no override is available and default is not verified', async () => {
      (ImagePullChecker.verifyImagePull as jest.Mock).mockResolvedValue(false);
      (ContainerImageOverrideMapper.getServiceImageOverride as jest.Mock).mockReturnValue(undefined);

      const result = await resolver.getServiceImage(serviceName as any, config)

      expect(result).toBe(serviceName)
      expect(ContainerImageOverrideMapper.getServiceImageOverride).toHaveBeenCalledWith(serviceName, config)
      expect(ImagePullChecker.verifyImagePull).toHaveBeenCalledWith(serviceName)
      expect(warningMock).toHaveBeenCalledWith('IMAGE_VERIFY_FAILED', `${undefined} -> ${serviceName}`)
    })
  })

  describe('getBffImage()', () => {
    const bffName = 'onecx/test-bff:latest'
    const config: any = { platformOverrides: { bffs: {} } }
    const overrideImage = 'my-custom/bff:latest'

    it('should return override image if available and verified', async () => {
      (ImagePullChecker.verifyImagePull as jest.Mock).mockResolvedValue(true);
      (ContainerImageOverrideMapper.getBffImageOverride as jest.Mock).mockReturnValue(overrideImage);

      const result = await resolver.getBffImage(bffName as any, config)

      expect(result).toBe(overrideImage)
      expect(ContainerImageOverrideMapper.getBffImageOverride).toHaveBeenCalledWith(bffName, config)
      expect(ImagePullChecker.verifyImagePull).toHaveBeenCalledWith(overrideImage)
    })

    it('should return default image if override is available but not verified', async () => {
      (ImagePullChecker.verifyImagePull as jest.Mock).mockResolvedValue(false);
      (ContainerImageOverrideMapper.getBffImageOverride as jest.Mock).mockReturnValue(overrideImage);

      const result = await resolver.getBffImage(bffName as any, config)

      expect(result).toBe(bffName)
      expect(ContainerImageOverrideMapper.getBffImageOverride).toHaveBeenCalledWith(bffName, config)
      expect(ImagePullChecker.verifyImagePull).toHaveBeenCalledWith(overrideImage)
      expect(warningMock).toHaveBeenCalledWith('IMAGE_VERIFY_FAILED', `${overrideImage} -> ${bffName}`)
    })

    it('should return default image if no override is available and default is verified', async () => {
      (ImagePullChecker.verifyImagePull as jest.Mock).mockResolvedValue(true);
      (ContainerImageOverrideMapper.getBffImageOverride as jest.Mock).mockReturnValue(undefined);

      const result = await resolver.getBffImage(bffName as any, config)

      expect(result).toBe(bffName)
      expect(ContainerImageOverrideMapper.getBffImageOverride).toHaveBeenCalledWith(bffName, config)
      expect(ImagePullChecker.verifyImagePull).toHaveBeenCalledWith(bffName)
    })

    it('should return default image if no override is available and default is not verified', async () => {
      (ImagePullChecker.verifyImagePull as jest.Mock).mockResolvedValue(false);
      (ContainerImageOverrideMapper.getBffImageOverride as jest.Mock).mockReturnValue(undefined);

      const result = await resolver.getBffImage(bffName as any, config)

      expect(result).toBe(bffName)
      expect(ContainerImageOverrideMapper.getBffImageOverride).toHaveBeenCalledWith(bffName, config)
      expect(ImagePullChecker.verifyImagePull).toHaveBeenCalledWith(bffName)
      expect(warningMock).toHaveBeenCalledWith('IMAGE_VERIFY_FAILED', `${undefined} -> ${bffName}`)
    })
  })

  describe('getUiImage()', () => {
    const uiName = 'onecx/test-ui:latest'
    const config: any = { platformOverrides: { uis: {} } }
    const overrideImage = 'my-custom/ui:latest'

    it('should return override image if available and verified', async () => {
      (ImagePullChecker.verifyImagePull as jest.Mock).mockResolvedValue(true);
      (ContainerImageOverrideMapper.getUiImageOverride as jest.Mock).mockReturnValue(overrideImage);

      const result = await resolver.getUiImage(uiName as any, config)

      expect(result).toBe(overrideImage)
      expect(ContainerImageOverrideMapper.getUiImageOverride).toHaveBeenCalledWith(uiName, config)
      expect(ImagePullChecker.verifyImagePull).toHaveBeenCalledWith(overrideImage)
    })

    it('should return default image if override is available but not verified', async () => {
      (ImagePullChecker.verifyImagePull as jest.Mock).mockResolvedValue(false);
      (ContainerImageOverrideMapper.getUiImageOverride as jest.Mock).mockReturnValue(overrideImage);

      const result = await resolver.getUiImage(uiName as any, config)

      expect(result).toBe(uiName)
      expect(ContainerImageOverrideMapper.getUiImageOverride).toHaveBeenCalledWith(uiName, config)
      expect(ImagePullChecker.verifyImagePull).toHaveBeenCalledWith(overrideImage)
      expect(warningMock).toHaveBeenCalledWith('IMAGE_VERIFY_FAILED', `${overrideImage} -> ${uiName}`)
    })

    it('should return default image if no override is available and default is verified', async () => {
      (ImagePullChecker.verifyImagePull as jest.Mock).mockResolvedValue(true);
      (ContainerImageOverrideMapper.getUiImageOverride as jest.Mock).mockReturnValue(undefined);

      const result = await resolver.getUiImage(uiName as any, config)

      expect(result).toBe(uiName)
      expect(ContainerImageOverrideMapper.getUiImageOverride).toHaveBeenCalledWith(uiName, config)
      expect(ImagePullChecker.verifyImagePull).toHaveBeenCalledWith(uiName)
    })

    it('should return default image if no override is available and default is not verified', async () => {
      (ImagePullChecker.verifyImagePull as jest.Mock).mockResolvedValue(false);
      (ContainerImageOverrideMapper.getUiImageOverride as jest.Mock).mockReturnValue(undefined);

      const result = await resolver.getUiImage(uiName as any, config)

      expect(result).toBe(uiName)
      expect(ContainerImageOverrideMapper.getUiImageOverride).toHaveBeenCalledWith(uiName, config)
      expect(ImagePullChecker.verifyImagePull).toHaveBeenCalledWith(uiName)
      expect(warningMock).toHaveBeenCalledWith('IMAGE_VERIFY_FAILED', `${undefined} -> ${uiName}`)
    })
  })
})
