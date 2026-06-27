import { ViewIcon, ViewOffIcon } from '@chakra-ui/icons'
import {
  Box,
  Button,
  Flex,
  FormControl,
  FormLabel,
  Grid,
  GridItem,
  Heading,
  HStack,
  IconButton,
  Input,
  InputGroup,
  InputRightElement,
  Text,
  VStack,
  useColorModeValue,
  useToast,
} from '@chakra-ui/react'
import BrandLockup from '../../components/Brand/BrandLockup'
import { jwtDecode } from 'jwt-decode'
import { useEffect, useState } from 'react'
import { FiCheckCircle } from 'react-icons/fi'
import { useHistory } from 'react-router-dom'
import { loginAdmin } from '../../services/auth.service'
import { useAuthStore } from '../../store/useAuthStore'

function isTokenValid(token) {
  try {
    const decoded = jwtDecode(token)
    return decoded.exp > Date.now() / 1000
  } catch {
    return false
  }
}

function SignIn() {
  const pageBg = useColorModeValue('#F3F6FE', '#09111F')
  const shellBg = useColorModeValue('#FFFFFF', '#101D36')
  const shellBorder = useColorModeValue('rgba(20,31,60,0.08)', 'rgba(148,163,184,0.14)')
  const showcaseBg = useColorModeValue(
    'linear-gradient(160deg, #1C275B 0%, #333D81 52%, #5B66B1 100%)',
    'linear-gradient(160deg, #0F172A 0%, #182447 48%, #23295D 100%)',
  )
  const textPrimary = useColorModeValue('#151C46', 'white')
  const textSecondary = useColorModeValue('#556188', 'rgba(255,255,255,0.72)')
  const inputBg = useColorModeValue('#F6F7FB', 'rgba(255,255,255,0.04)')
  const inputBorder = useColorModeValue('rgba(20,31,60,0.12)', 'rgba(255,255,255,0.1)')
  const iconHoverBg = useColorModeValue('rgba(51,61,129,0.08)', 'rgba(255,255,255,0.08)')

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const toast = useToast()
  const history = useHistory()
  const login = useAuthStore((state) => state.login)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)

    try {
      const data = await loginAdmin(email, password)
      login(data.token, data?.user?.id, data.refreshToken)

      toast({
        title: 'Login successful',
        status: 'success',
        duration: 2000,
        isClosable: true,
      })

      history.push('/admin/dashboard')
    } catch (err) {
      toast({
        title: 'Login failed',
        description: err.response?.data?.error || 'Something went wrong',
        status: 'error',
        duration: 3000,
        isClosable: true,
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const accessToken = localStorage.getItem('accessToken')
    const refreshToken = localStorage.getItem('refreshToken')

    if (accessToken && refreshToken && isTokenValid(refreshToken)) {
      history.replace('/admin/dashboard')
    }
  }, [history])

  return (
    <Flex minH="100vh" bg={pageBg} px={{ base: 3, md: 4 }} py={{ base: 3, md: 4 }}>
      <Grid
        templateColumns={{ base: '1fr', lg: '1.12fr 0.88fr' }}
        w="100%"
        maxW="1510px"
        mx="auto"
        gap={{ base: 3, lg: 4 }}
        alignItems="stretch"
      >
        <GridItem display={{ base: 'none', lg: 'block' }}>
          <Box
            minH={{ lg: 'calc(100vh - 32px)' }}
            bg={showcaseBg}
            border="1px solid"
            borderColor={shellBorder}
            position="relative"
            overflow="hidden"
            boxShadow={useColorModeValue('0 18px 45px rgba(21, 30, 55, 0.08)', '0 24px 60px rgba(2, 8, 23, 0.42)')}
          >
            <Box
              position="absolute"
              inset="0"
              bgImage="radial-gradient(circle at 18% 18%, rgba(255,255,255,0.22) 0%, transparent 28%), radial-gradient(circle at 82% 14%, rgba(206,40,38,0.18) 0%, transparent 24%), linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0))"
            />

            <VStack align="stretch" spacing={0} h="100%" p={{ md: 8, lg: 10 }} position="relative" zIndex="1">
              <HStack spacing={4} mb={10}>
                <BrandLockup
                  iconSize={56}
                  nameColor="white"
                  taglineColor="rgba(255,255,255,0.66)"
                  nameSize={{ base: '2xl', md: '3xl' }}
                  tagline="Admin Control Center"
                />
              </HStack>

              <VStack align="start" spacing={5} maxW="560px">
                <Heading fontSize={{ base: '3xl', md: '4xl' }} lineHeight="1.02" letterSpacing="-0.04em" color="white">
                  Run IntleExpress operations from one focused admin command layer.
                </Heading>
                <Text color="rgba(255,255,255,0.72)" fontSize="md" lineHeight="1.9">
                  Oversee pricing, users, serviceability, support, billing, and logistics execution
                  from a cleaner admin console built for daily operational control.
                </Text>
              </VStack>

              <Grid templateColumns="repeat(3, 1fr)" gap={4} mt={10}>
                {[
                  { title: 'Pricing', body: 'manage courier logic, plans, and platform commercials' },
                  { title: 'Operations', body: 'review orders, NDR, RTO, and exception workflows' },
                  { title: 'Support', body: 'track users, tickets, notifications, and admin actions' },
                ].map((item) => (
                  <Box
                    key={item.title}
                    p={4}
                    borderRadius="8px"
                    bg="rgba(255,255,255,0.08)"
                    border="1px solid rgba(255,255,255,0.14)"
                    backdropFilter="blur(12px)"
                  >
                    <Text fontSize="sm" fontWeight="800" color="white">
                      {item.title}
                    </Text>
                    <Text mt={2} fontSize="sm" lineHeight="1.7" color="rgba(255,255,255,0.7)">
                      {item.body}
                    </Text>
                  </Box>
                ))}
              </Grid>

              <VStack align="start" spacing={3} mt="auto" pt={12}>
                {[
                  'Unified workspace for pricing, operations, and support',
                  'Cleaner navigation across all admin routes',
                  'Secure sign-in flow for platform administrators',
                ].map((item) => (
                  <HStack key={item} spacing={3} align="start">
                    <Box pt="1">
                      <FiCheckCircle color="#C7D2FE" size={15} />
                    </Box>
                    <Text color="white" fontSize="sm" fontWeight="600">
                      {item}
                    </Text>
                  </HStack>
                ))}
              </VStack>
            </VStack>
          </Box>
        </GridItem>

        <GridItem display="flex" alignItems="center" justifyContent="center">
          <Box
            w="100%"
            maxW={{ base: 720, lg: 'none' }}
            minH={{ lg: 'calc(100vh - 32px)' }}
            bg={shellBg}
            border="1px solid"
            borderColor={shellBorder}
            borderRadius={{ base: '20px', lg: '24px' }}
            boxShadow={useColorModeValue('0 18px 45px rgba(21, 30, 55, 0.08)', '0 24px 60px rgba(2, 8, 23, 0.42)')}
            overflow="hidden"
            display="flex"
            alignItems="center"
            px={{ base: 5, sm: 7, lg: 8 }}
            py={{ base: 6, sm: 8 }}
          >
            <Box as="form" onSubmit={handleSubmit} w="100%" maxW="440px" mx="auto">
              <VStack spacing={6} align="stretch">
                <Box>
                  <Text fontSize="xs" fontWeight="800" letterSpacing="0.16em" color="brand.500" mb={2} textTransform="uppercase">
                    Secure Access
                  </Text>
                  <Heading fontSize={{ base: '2xl', md: '3xl' }} fontWeight="800" color={textPrimary} lineHeight="1.08" letterSpacing="-0.03em">
                    Sign in to IntleExpress Admin
                  </Heading>
                  <Text mt={2} color={textSecondary} fontSize="sm" lineHeight="1.8">
                    Enter your administrator credentials to continue to the IntleExpress control center.
                  </Text>
                </Box>

                <FormControl isRequired>
                  <FormLabel fontSize="sm" fontWeight="700" color={textPrimary} mb={2}>
                    Email
                  </FormLabel>
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="admin@intlexpress.com"
                    h="50px"
                    borderRadius="8px"
                    bg={inputBg}
                    borderColor={inputBorder}
                    _hover={{ borderColor: 'brand.400' }}
                    _focus={{
                      borderColor: 'brand.500',
                      boxShadow: '0 0 0 3px rgba(51,61,129,0.12)',
                    }}
                  />
                </FormControl>

                <FormControl isRequired>
                  <FormLabel fontSize="sm" fontWeight="700" color={textPrimary} mb={2}>
                    Password
                  </FormLabel>
                  <InputGroup>
                    <Input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter your password"
                      h="50px"
                      borderRadius="8px"
                      bg={inputBg}
                      borderColor={inputBorder}
                      pr="48px"
                      _hover={{ borderColor: 'brand.400' }}
                      _focus={{
                        borderColor: 'brand.500',
                        boxShadow: '0 0 0 3px rgba(51,61,129,0.12)',
                      }}
                    />
                    <InputRightElement h="50px" pr="8px">
                      <IconButton
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                        icon={showPassword ? <ViewOffIcon /> : <ViewIcon />}
                        variant="ghost"
                        size="sm"
                        color={textSecondary}
                        onClick={() => setShowPassword(!showPassword)}
                        _hover={{ bg: iconHoverBg, color: 'brand.500' }}
                      />
                    </InputRightElement>
                  </InputGroup>
                </FormControl>

                <Button
                  type="submit"
                  h="50px"
                  borderRadius="8px"
                  bg="brand.500"
                  color="white"
                  fontWeight="700"
                  isLoading={loading}
                  loadingText="Signing in"
                  _hover={{ bg: 'brand.600' }}
                  _active={{ bg: 'brand.700' }}
                >
                  Sign In
                </Button>
              </VStack>
            </Box>
          </Box>
        </GridItem>
      </Grid>
    </Flex>
  )
}

export default SignIn
