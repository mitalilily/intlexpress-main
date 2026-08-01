import {
  Alert,
  AlertDescription,
  AlertIcon,
  Badge,
  Box,
  Button,
  Flex,
  FormControl,
  FormLabel,
  Grid,
  GridItem,
  Input,
  Spinner,
  Stack,
  Switch,
  Text,
  useToast,
  VStack,
} from '@chakra-ui/react'
import { useEffect, useMemo, useState } from 'react'
import {
  useCourierCredentials,
  useDelhiveryB2BLogin,
  useDelhiveryB2BLogout,
  useDelhiveryForgotPassword,
  useUpdateDelhiveryCredentials,
} from 'hooks/useCouriers'

const DELHIVERY_API_BASE = 'https://track.delhivery.com'
const DELHIVERY_B2B_AUTH_API_BASE = 'https://ltl-clients-api.delhivery.com'
const ACCOUNT_CODES = ['account_1', 'account_2', 'account_3']
const AUTH_ACCOUNT_INDEXES = [0, 1, 2]
const ACCOUNT_PRESETS = [
  {
    title: 'B2C API Authentication',
    defaultLabel: 'Delhivery B2C Account',
    description: 'Token auth used by Delhivery B2C shipment APIs.',
  },
  {
    title: 'B2B API Authentication 1',
    defaultLabel: 'Delhivery B2B Account 1',
    description: 'First independent Delhivery B2B account shown as its own courier option.',
  },
  {
    title: 'B2B API Authentication 2',
    defaultLabel: 'Delhivery B2B Account 2',
    description: 'Second independent Delhivery B2B account shown as its own courier option.',
  },
]

const buildEmptyAccount = (index) => ({
  accountCode: ACCOUNT_CODES[index],
  accountLabel: ACCOUNT_PRESETS[index]?.defaultLabel || `Delhivery Account ${index + 1}`,
  apiBase: index > 0 ? DELHIVERY_B2B_AUTH_API_BASE : DELHIVERY_API_BASE,
  clientName: '',
  apiKey: '',
  username: '',
  password: '',
  hasApiKey: false,
  apiKeyMasked: '',
  hasPassword: false,
  passwordMasked: '',
  hasB2BAuthToken: false,
  b2bAuthTokenExpiresAt: '',
  isActive: true,
  isDefault: index === 0,
  pickupLocationIds: [],
  pickupLocationNames: [],
})

const normalizeArrayInput = (value) => {
  if (Array.isArray(value)) {
    return value
      .map((entry) => String(entry || '').trim())
      .filter(Boolean)
      .filter((entry, index, source) => source.indexOf(entry) === index)
  }

  return String(value || '')
    .split(/[\n,]+/)
    .map((entry) => entry.trim())
    .filter(Boolean)
    .filter((entry, index, source) => source.indexOf(entry) === index)
}

const normalizeApiBase = (value, index) => {
  const normalized = String(value || '').trim()
  if (index > 0 && (!normalized || !normalized.toLowerCase().includes('ltl-clients-api'))) {
    return DELHIVERY_B2B_AUTH_API_BASE
  }

  return normalized || (index > 0 ? DELHIVERY_B2B_AUTH_API_BASE : DELHIVERY_API_BASE)
}

const normalizeAccounts = (accounts) =>
  ACCOUNT_CODES.map((accountCode, index) => {
    const incoming = Array.isArray(accounts) ? accounts[index] : null
    const empty = buildEmptyAccount(index)

    return incoming
      ? {
          ...empty,
          ...incoming,
          accountCode,
          apiBase: normalizeApiBase(incoming.apiBase, index),
          pickupLocationIds: Array.isArray(incoming.pickupLocationIds)
            ? incoming.pickupLocationIds
            : normalizeArrayInput(incoming.pickupLocationIds),
          pickupLocationNames: Array.isArray(incoming.pickupLocationNames)
            ? incoming.pickupLocationNames
            : normalizeArrayInput(incoming.pickupLocationNames),
        }
      : empty
  }).map((account, index, source) => ({
    ...account,
    isDefault:
      account.isDefault === true &&
      source.findIndex((entry) => entry.isDefault === true) === index,
  }))

const isConfiguredAccount = (account, index) => {
  if (index > 0) {
    return Boolean(String(account.username || '').trim()) && Boolean(account.hasPassword || account.password)
  }

  return Boolean(account.hasApiKey || account.apiKey)
}

const buildSavedAccount = (account, index) => ({
  accountCode: account.accountCode,
  accountLabel: account.accountLabel,
  apiBase: normalizeApiBase(account.apiBase, index),
  clientName: account.clientName,
  apiKey: account.apiKey,
  username: account.username,
  password: account.password,
  isActive: account.isActive,
  isDefault: account.isDefault,
  pickupLocationIds: normalizeArrayInput(account.pickupLocationIds),
  pickupLocationNames: normalizeArrayInput(account.pickupLocationNames),
})

const CourierCredentials = () => {
  const toast = useToast()
  const { data, isLoading, error } = useCourierCredentials()
  const updateDelhivery = useUpdateDelhiveryCredentials()
  const forgotPasswordMutation = useDelhiveryForgotPassword()
  const b2bLoginMutation = useDelhiveryB2BLogin()
  const b2bLogoutMutation = useDelhiveryB2BLogout()
  const [accounts, setAccounts] = useState(() => normalizeAccounts([]))

  useEffect(() => {
    setAccounts(normalizeAccounts(data?.delhivery?.accounts))
  }, [data])

  const visibleAccounts = useMemo(
    () => accounts.filter((_, index) => AUTH_ACCOUNT_INDEXES.includes(index)),
    [accounts],
  )

  const authSummary = useMemo(
    () => ({
      b2cReady: isConfiguredAccount(accounts[0] || buildEmptyAccount(0), 0),
      b2b1Ready: isConfiguredAccount(accounts[1] || buildEmptyAccount(1), 1),
      b2b2Ready: isConfiguredAccount(accounts[2] || buildEmptyAccount(2), 2),
    }),
    [accounts],
  )

  const updateAccount = (index, patch) => {
    setAccounts((current) =>
      current.map((account, accountIndex) => {
        if (accountIndex !== index) return account
        return { ...account, ...patch }
      }),
    )
  }

  const handleSave = () => {
    updateDelhivery.mutate(
      {
        accounts: accounts.map(buildSavedAccount),
      },
      {
        onSuccess: (saved) => {
          toast({
            title: 'Courier credentials updated',
            status: 'success',
          })
          setAccounts(normalizeAccounts(saved?.accounts))
        },
        onError: (err) => {
          toast({
            title: 'Failed to update courier credentials',
            description: err?.message,
            status: 'error',
          })
        },
      },
    )
  }

  const handleForgotPassword = (account) => {
    forgotPasswordMutation.mutate(
      {
        accountCode: account.accountCode,
        username: account.username,
        apiBase: account.apiBase,
      },
      {
        onSuccess: (response) => {
          toast({
            title: 'B2B password reset request submitted',
            description: response?.message,
            status: 'success',
          })
        },
        onError: (err) => {
          toast({
            title: 'Failed to submit B2B password reset request',
            description: err?.message,
            status: 'error',
          })
        },
      },
    )
  }

  const handleB2BLogin = (account) => {
    b2bLoginMutation.mutate(
      {
        accountCode: account.accountCode,
        username: account.username,
        password: account.password,
        apiBase: account.apiBase,
      },
      {
        onSuccess: (response) => {
          toast({
            title: 'B2B login successful',
            description: response?.data?.expiresAt
              ? `Token valid until ${new Date(response.data.expiresAt).toLocaleString()}`
              : response?.message,
            status: 'success',
          })
        },
        onError: (err) => {
          toast({
            title: 'B2B login failed',
            description: err?.message,
            status: 'error',
          })
        },
      },
    )
  }

  const handleB2BLogout = (account) => {
    b2bLogoutMutation.mutate(
      {
        accountCode: account.accountCode,
        apiBase: account.apiBase,
      },
      {
        onSuccess: (response) => {
          toast({
            title: 'B2B token logged out',
            description: response?.message,
            status: 'success',
          })
        },
        onError: (err) => {
          toast({
            title: 'B2B logout failed',
            description: err?.message,
            status: 'error',
          })
        },
      },
    )
  }

  if (isLoading) return <Spinner size="md" />

  return (
    <Flex direction="column" pt={{ base: '120px', md: '75px' }} gap={5}>
      {error && (
        <Alert status="warning" borderRadius="lg">
          <AlertIcon />
          <AlertDescription>
            Courier credentials could not be loaded from the API. Blank fallback cards are shown so
            fresh authentication details can still be saved.
          </AlertDescription>
        </Alert>
      )}

      <Stack spacing={1}>
        <Text fontSize="xl" fontWeight="bold">
          Courier Credentials
        </Text>
        <Text color="gray.500">
          Manage Delhivery B2C plus two independent Delhivery B2B accounts.
        </Text>
      </Stack>

      <Flex gap={3} wrap="wrap">
        <Badge colorScheme={authSummary.b2cReady ? 'green' : 'orange'} px={3} py={1} borderRadius="full">
          B2C {authSummary.b2cReady ? 'ready' : 'missing token'}
        </Badge>
        <Badge colorScheme={authSummary.b2b1Ready ? 'green' : 'orange'} px={3} py={1} borderRadius="full">
          B2B 1 {authSummary.b2b1Ready ? 'ready' : 'missing login'}
        </Badge>
        <Badge colorScheme={authSummary.b2b2Ready ? 'green' : 'orange'} px={3} py={1} borderRadius="full">
          B2B 2 {authSummary.b2b2Ready ? 'ready' : 'missing login'}
        </Badge>
      </Flex>

      <Grid templateColumns={{ base: '1fr', xl: 'repeat(3, minmax(0, 1fr))' }} gap={4}>
        {visibleAccounts.map((account, visibleIndex) => {
          const index = AUTH_ACCOUNT_INDEXES[visibleIndex]
          const isB2BAccount = index > 0
          const isConfigured = isConfiguredAccount(account, index)

          return (
            <GridItem key={account.accountCode}>
              <Box borderWidth="1px" borderRadius="lg" p={5} h="100%">
                <VStack spacing={4} align="stretch" h="100%">
                  <Flex justify="space-between" align="flex-start" gap={3}>
                    <Stack spacing={1}>
                      <Text fontWeight="semibold">
                        {ACCOUNT_PRESETS[index]?.title || `Account ${index + 1}`}
                      </Text>
                      <Text fontSize="sm" color="gray.500">
                        {ACCOUNT_PRESETS[index]?.description}
                      </Text>
                    </Stack>
                    <Badge colorScheme={isConfigured ? 'green' : 'orange'} flexShrink={0}>
                      {isConfigured ? 'Configured' : 'Missing'}
                    </Badge>
                  </Flex>

                  <FormControl display="flex" alignItems="center" justifyContent="space-between">
                    <FormLabel mb="0">Enable this account</FormLabel>
                    <Switch
                      isChecked={account.isActive !== false}
                      onChange={(event) => updateAccount(index, { isActive: event.target.checked })}
                    />
                  </FormControl>

                  <FormControl>
                    <FormLabel>{isB2BAccount ? 'Auth API Base URL' : 'API Base URL'}</FormLabel>
                    <Input
                      value={account.apiBase}
                      onChange={(event) => updateAccount(index, { apiBase: event.target.value })}
                      placeholder={isB2BAccount ? DELHIVERY_B2B_AUTH_API_BASE : DELHIVERY_API_BASE}
                    />
                  </FormControl>

                  {!isB2BAccount && (
                    <>
                      <FormControl>
                        <FormLabel>Client Name</FormLabel>
                        <Input
                          value={account.clientName}
                          onChange={(event) =>
                            updateAccount(index, { clientName: event.target.value })
                          }
                          placeholder="Registered Delhivery client name"
                        />
                      </FormControl>

                      <FormControl>
                        <FormLabel>API Key</FormLabel>
                        <Input
                          type="password"
                          value={account.apiKey}
                          onChange={(event) => updateAccount(index, { apiKey: event.target.value })}
                          placeholder={account.apiKeyMasked || 'Token used in Authorization header'}
                        />
                        {!!account.apiKeyMasked && !account.apiKey && (
                          <Text fontSize="xs" color="gray.500" mt={1}>
                            Current key: {account.apiKeyMasked}
                          </Text>
                        )}
                      </FormControl>
                    </>
                  )}

                  {isB2BAccount && (
                    <>
                      <FormControl>
                        <FormLabel>Username</FormLabel>
                        <Input
                          value={account.username || ''}
                          onChange={(event) =>
                            updateAccount(index, { username: event.target.value, isActive: true })
                          }
                          placeholder="Delhivery B2B username"
                        />
                      </FormControl>

                      <FormControl>
                        <FormLabel>Password</FormLabel>
                        <Input
                          type="password"
                          value={account.password || ''}
                          onChange={(event) =>
                            updateAccount(index, { password: event.target.value, isActive: true })
                          }
                          placeholder={account.passwordMasked || 'Delhivery B2B password'}
                        />
                        {!!account.passwordMasked && !account.password && (
                          <Text fontSize="xs" color="gray.500" mt={1}>
                            Saved password is already configured.
                          </Text>
                        )}
                      </FormControl>

                      <Flex gap={2} wrap="wrap">
                        <Badge colorScheme={account.hasB2BAuthToken ? 'green' : 'gray'}>
                          {account.hasB2BAuthToken ? 'Token cached' : 'No cached token'}
                        </Badge>
                        {!!account.b2bAuthTokenExpiresAt && (
                          <Badge colorScheme="blue">
                            Expires {new Date(account.b2bAuthTokenExpiresAt).toLocaleString()}
                          </Badge>
                        )}
                      </Flex>

                      <Flex gap={2} wrap="wrap">
                        <Button
                          colorScheme="blue"
                          variant="outline"
                          onClick={() => handleB2BLogin(account)}
                          isLoading={
                            b2bLoginMutation.isPending &&
                            b2bLoginMutation.variables?.accountCode === account.accountCode
                          }
                          isDisabled={
                            !String(account.username || '').trim() ||
                            (!String(account.password || '').trim() && !account.hasPassword)
                          }
                        >
                          Refresh B2B Token
                        </Button>

                        <Button
                          variant="outline"
                          onClick={() => handleB2BLogout(account)}
                          isLoading={b2bLogoutMutation.isPending}
                          isDisabled={!account.hasB2BAuthToken}
                        >
                          Logout Token
                        </Button>

                        <Button
                          variant="outline"
                          onClick={() => handleForgotPassword(account)}
                          isLoading={
                            forgotPasswordMutation.isPending &&
                            forgotPasswordMutation.variables?.accountCode === account.accountCode
                          }
                          isDisabled={!String(account.username || '').trim()}
                        >
                          Reset Password
                        </Button>
                      </Flex>
                    </>
                  )}
                </VStack>
              </Box>
            </GridItem>
          )
        })}
      </Grid>

      <Flex justify="flex-end">
        <Button colorScheme="blue" onClick={handleSave} isLoading={updateDelhivery.isPending}>
          Save Courier Credentials
        </Button>
      </Flex>
    </Flex>
  )
}

export default CourierCredentials
