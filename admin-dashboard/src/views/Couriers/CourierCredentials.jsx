import { CopyIcon } from '@chakra-ui/icons'
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
  Textarea,
  useToast,
  VStack,
} from '@chakra-ui/react'
import { useEffect, useMemo, useState } from 'react'
import {
  useCourierCredentials,
  useUpdateDelhiveryCredentials,
} from 'hooks/useCouriers'

const ACCOUNT_CODES = ['account_1', 'account_2', 'account_3']

const buildEmptyAccount = (index) => ({
  accountCode: ACCOUNT_CODES[index],
  accountLabel: `Delhivery Account ${index + 1}`,
  apiBase: 'https://track.delhivery.com',
  clientName: '',
  apiKey: '',
  hasApiKey: false,
  apiKeyMasked: '',
  isActive: index === 0,
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

const normalizeAccounts = (accounts) =>
  ACCOUNT_CODES.map((accountCode, index) => {
    const incoming = Array.isArray(accounts) ? accounts[index] : null
    const empty = buildEmptyAccount(index)

    return incoming
      ? {
          ...empty,
          ...incoming,
          accountCode,
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

const CourierCredentials = () => {
  const toast = useToast()
  const { data, isLoading, error } = useCourierCredentials()
  const updateDelhivery = useUpdateDelhiveryCredentials()
  const [accounts, setAccounts] = useState(() => normalizeAccounts([]))

  useEffect(() => {
    setAccounts(normalizeAccounts(data?.delhivery?.accounts))
  }, [data])

  const delhiveryWebhookConfig = data?.delhivery?.webhookConfig || {}

  const accountSummary = useMemo(
    () => ({
      configured: accounts.filter((account) => account.hasApiKey || account.apiKey).length,
      active: accounts.filter((account) => account.isActive).length,
    }),
    [accounts],
  )

  const handleCopyWebhookUrl = async (value, label) => {
    if (!value) return

    try {
      await navigator.clipboard.writeText(value)
      toast({ title: `${label} copied`, status: 'success' })
    } catch {
      const textarea = document.createElement('textarea')
      textarea.value = value
      textarea.setAttribute('readonly', '')
      textarea.style.position = 'absolute'
      textarea.style.left = '-9999px'
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      document.body.removeChild(textarea)
      toast({ title: `${label} copied`, status: 'success' })
    }
  }

  const updateAccount = (index, patch) => {
    setAccounts((current) =>
      current.map((account, accountIndex) => {
        if (accountIndex !== index) return account
        return { ...account, ...patch }
      }),
    )
  }

  const handleToggleDefault = (index) => {
    setAccounts((current) =>
      current.map((account, accountIndex) => ({
        ...account,
        isDefault: accountIndex === index,
        isActive: accountIndex === index ? true : account.isActive,
      })),
    )
  }

  const handleSave = () => {
    updateDelhivery.mutate(
      {
        accounts: accounts.map((account) => ({
          accountCode: account.accountCode,
          accountLabel: account.accountLabel,
          apiBase: account.apiBase,
          clientName: account.clientName,
          apiKey: account.apiKey,
          isActive: account.isActive,
          isDefault: account.isDefault,
          pickupLocationIds: normalizeArrayInput(account.pickupLocationIds),
          pickupLocationNames: normalizeArrayInput(account.pickupLocationNames),
        })),
      },
      {
        onSuccess: (saved) => {
          toast({
            title: 'Delhivery accounts updated',
            status: 'success',
          })
          setAccounts(normalizeAccounts(saved?.accounts))
        },
        onError: (err) => {
          toast({
            title: 'Failed to update Delhivery accounts',
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
            Delhivery credentials could not be loaded from the API, so blank fallback cards are
            shown. You can still save fresh account details from here.
          </AlertDescription>
        </Alert>
      )}

      <Stack spacing={1}>
        <Text fontSize="xl" fontWeight="bold">
          Delhivery Accounts
        </Text>
        <Text color="gray.500">
          Configure up to three Delhivery accounts and map pickup locations to the right account.
        </Text>
      </Stack>

      <Flex gap={3} wrap="wrap">
        <Badge colorScheme="green" px={3} py={1} borderRadius="full">
          {accountSummary.configured} configured
        </Badge>
        <Badge colorScheme="blue" px={3} py={1} borderRadius="full">
          {accountSummary.active} active
        </Badge>
      </Flex>

      <Box borderWidth="1px" borderRadius="lg" p={5}>
        <VStack spacing={4} align="stretch">
          <Text fontWeight="semibold">Webhook Setup</Text>

          <FormControl>
            <FormLabel>Scan Push Webhook URL</FormLabel>
            <Flex gap={2}>
              <Input value={delhiveryWebhookConfig.scanPushUrl || ''} isReadOnly fontSize="sm" />
              <Button
                size="sm"
                leftIcon={<CopyIcon />}
                onClick={() =>
                  handleCopyWebhookUrl(
                    delhiveryWebhookConfig.scanPushUrl,
                    'Scan push webhook URL',
                  )
                }
                isDisabled={!delhiveryWebhookConfig.scanPushUrl}
              >
                Copy
              </Button>
            </Flex>
          </FormControl>

          <FormControl>
            <FormLabel>Document Push Webhook URL</FormLabel>
            <Flex gap={2}>
              <Input
                value={delhiveryWebhookConfig.documentPushUrl || ''}
                isReadOnly
                fontSize="sm"
              />
              <Button
                size="sm"
                leftIcon={<CopyIcon />}
                onClick={() =>
                  handleCopyWebhookUrl(
                    delhiveryWebhookConfig.documentPushUrl,
                    'Document push webhook URL',
                  )
                }
                isDisabled={!delhiveryWebhookConfig.documentPushUrl}
              >
                Copy
              </Button>
            </Flex>
          </FormControl>

          <Text fontSize="sm" color="gray.500">
            Orders stay visible to merchants as Delhivery. The backend picks an account using pickup
            location mappings, then falls back to the default active account.
          </Text>
        </VStack>
      </Box>

      <Grid templateColumns={{ base: '1fr', xl: 'repeat(3, 1fr)' }} gap={4}>
        {accounts.map((account, index) => (
          <GridItem key={account.accountCode}>
            <Box borderWidth="1px" borderRadius="lg" p={5} h="100%">
              <VStack spacing={4} align="stretch" h="100%">
                <Flex justify="space-between" align="center">
                  <Stack spacing={0}>
                    <Text fontWeight="semibold">{`Account ${index + 1}`}</Text>
                    <Text fontSize="sm" color="gray.500">
                      {account.accountCode}
                    </Text>
                  </Stack>
                  <Badge
                    colorScheme={account.hasApiKey || account.apiKey ? 'green' : 'orange'}
                  >
                    {account.hasApiKey || account.apiKey ? 'Configured' : 'Missing API key'}
                  </Badge>
                </Flex>

                <FormControl>
                  <FormLabel>Account Label</FormLabel>
                  <Input
                    value={account.accountLabel}
                    onChange={(e) => updateAccount(index, { accountLabel: e.target.value })}
                    placeholder={`Delhivery Account ${index + 1}`}
                  />
                </FormControl>

                <FormControl>
                  <FormLabel>API Base URL</FormLabel>
                  <Input
                    value={account.apiBase}
                    onChange={(e) => updateAccount(index, { apiBase: e.target.value })}
                    placeholder="https://track.delhivery.com"
                  />
                </FormControl>

                <FormControl>
                  <FormLabel>Client Name</FormLabel>
                  <Input
                    value={account.clientName}
                    onChange={(e) => updateAccount(index, { clientName: e.target.value })}
                    placeholder="Registered Delhivery client name"
                  />
                </FormControl>

                <FormControl>
                  <FormLabel>API Key</FormLabel>
                  <Input
                    type="password"
                    value={account.apiKey}
                    onChange={(e) => updateAccount(index, { apiKey: e.target.value })}
                    placeholder={account.apiKeyMasked || 'Enter Delhivery API key'}
                  />
                  {!!account.apiKeyMasked && !account.apiKey && (
                    <Text fontSize="xs" color="gray.500" mt={1}>
                      Current key: {account.apiKeyMasked}
                    </Text>
                  )}
                </FormControl>

                <FormControl>
                  <FormLabel>Pickup Location IDs</FormLabel>
                  <Textarea
                    rows={3}
                    value={(account.pickupLocationIds || []).join('\n')}
                    onChange={(e) =>
                      updateAccount(index, {
                        pickupLocationIds: normalizeArrayInput(e.target.value),
                      })
                    }
                    placeholder="One pickup location ID per line"
                  />
                </FormControl>

                <FormControl>
                  <FormLabel>Pickup Warehouse Names</FormLabel>
                  <Textarea
                    rows={3}
                    value={(account.pickupLocationNames || []).join('\n')}
                    onChange={(e) =>
                      updateAccount(index, {
                        pickupLocationNames: normalizeArrayInput(e.target.value),
                      })
                    }
                    placeholder="One warehouse name per line"
                  />
                </FormControl>

                <Stack spacing={3} pt={1}>
                  <Flex align="center" justify="space-between">
                    <Text fontSize="sm">Active for booking</Text>
                    <Switch
                      isChecked={account.isActive}
                      onChange={(e) => updateAccount(index, { isActive: e.target.checked })}
                    />
                  </Flex>

                  <Flex align="center" justify="space-between">
                    <Text fontSize="sm">Default fallback account</Text>
                    <Switch
                      isChecked={account.isDefault}
                      onChange={() => handleToggleDefault(index)}
                    />
                  </Flex>
                </Stack>
              </VStack>
            </Box>
          </GridItem>
        ))}
      </Grid>

      <Flex justify="flex-end">
        <Button
          colorScheme="blue"
          onClick={handleSave}
          isLoading={updateDelhivery.isPending}
        >
          Save Delhivery Accounts
        </Button>
      </Flex>
    </Flex>
  )
}

export default CourierCredentials
