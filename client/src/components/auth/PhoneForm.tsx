import {
  Box,
  FormControlLabel,
  Link,
  Stack,
  Typography,
} from '@mui/material'
import { useCallback, useEffect, useState, type ChangeEvent, type FormEvent } from 'react'
import { FiMail } from 'react-icons/fi'
import { type RequestOtpResponse } from '../../api/auth'
import { useRequestOtp } from '../../hooks/useOTP'
import { TERMS_AND_CONDITIONS } from '../../utils/constants'
import CustomIconLoadingButton from '../UI/button/CustomLoadingButton'
import CustomCheckbox from '../UI/inputs/CustomCheckbox'
import CustomInput from '../UI/inputs/CustomInput'
import CustomModal from '../UI/modal/CustomModal'
import { toast } from '../UI/Toast'
import OtpForm from './OtpForm'

const BRAND_ORANGE = '#333d81'
const BRAND_DARK = '#141414'

const primaryButtonStyles = {
  width: '100%',
  borderRadius: 4,
  background: `linear-gradient(135deg, ${BRAND_ORANGE} 0%, #23295d 100%)`,
  boxShadow: 'none',
  minHeight: 52,
}

const secondaryButtonStyles = {
  width: '100%',
  border: '1px solid rgba(20, 20, 20, 0.1)',
  backgroundColor: '#ffffff',
  color: BRAND_DARK,
  borderRadius: 4,
  minHeight: 48,
}

export default function PhoneForm() {
  const activeEmail = sessionStorage.getItem('activeEmail')
  const [step, setStep] = useState<number>(0)
  const [email, setEmail] = useState('')
  const [termsChecked, setTermsChecked] = useState(false)
  const [openTerms, setOpenTerms] = useState(false)
  const [visibleOtp, setVisibleOtp] = useState<string | null>(null)

  const { mutate: sendOtpRequest, isPending } = useRequestOtp()

  const handleEmailChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    setEmail(e.target.value.trim())
  }, [])

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  const isValidEmail = email.length > 0 && emailRegex.test(email)

  const handleSubmit = useCallback(
    (e: FormEvent) => {
      e.preventDefault()

      if (!termsChecked) {
        toast.open({
          message: 'Please accept the Terms and Conditions to continue.',
          severity: 'warning',
          position: { vertical: 'top', horizontal: 'center' },
        })
        return
      }

      sessionStorage.setItem('preferredMethod', 'phone')

      sendOtpRequest(email.toLowerCase().trim(), {
        onSuccess: (data: RequestOtpResponse) => {
          setVisibleOtp(data?.otp ?? null)
          setStep(1)

          if (data?.otp) {
            toast.open({
              message: 'Console OTP is now visible on screen.',
              severity: 'success',
              position: { vertical: 'top', horizontal: 'center' },
            })
          }
        },
        onError: (err: any) => {
          const msg =
            err?.response?.data?.error || 'Failed to generate on-screen demo OTP. Please try again.'
          toast.open({
            message: msg,
            severity: 'error',
            position: { vertical: 'top', horizontal: 'center' },
          })
        },
      })
    },
    [email, termsChecked, sendOtpRequest],
  )

  useEffect(() => {
    if (activeEmail) setEmail(activeEmail)
  }, [activeEmail])

  const termsLabel = (
    <Typography fontSize="13px" display="flex" alignItems="center" gap="3px" color="#6E6763">
      I agree to{' '}
      <Link
        component="button"
        underline="hover"
        onClick={() => setOpenTerms(true)}
        sx={{ cursor: 'pointer', color: BRAND_ORANGE, fontWeight: 800 }}
      >
        Terms and Conditions
      </Link>
    </Typography>
  )

  const renderOtpEntry = () =>
    step === 0 ? (
      <Box component="form" onSubmit={handleSubmit} width="100%">
        <Stack spacing={2}>
          <Box
            sx={{
              p: 1.5,
              border: '1px solid rgba(17,17,19,0.08)',
              background: '#faf7f4',
            }}
          >
            <Typography
              sx={{
                fontSize: '0.75rem',
                fontWeight: 800,
                color: BRAND_ORANGE,
                textTransform: 'uppercase',
                letterSpacing: '0.14em',
                mb: 0.6,
              }}
            >
              Console OTP Sign-In
            </Typography>

            <Typography sx={{ color: '#6E6763', fontSize: '0.88rem', lineHeight: 1.6 }}>
              Request a sign-in code and surface it directly on screen for a fast console-style login.
            </Typography>
          </Box>

          <CustomInput
            type="email"
            label="Work Email"
            value={email}
            name="email"
            id="email"
            onChange={handleEmailChange}
            required
            error={email.length > 0 && !isValidEmail}
            helperText={email.length > 0 && !isValidEmail ? 'Enter a valid email address.' : ''}
            autoFocus
            prefix={<FiMail color={BRAND_ORANGE} size={15} />}
          />

          <FormControlLabel
            sx={{ m: 0, alignItems: 'flex-start' }}
            control={
              <CustomCheckbox
                checked={termsChecked}
                onChange={(e) => setTermsChecked(e.target.checked)}
                color="primary"
              />
            }
            label={
              <Typography mt={0.35} variant="body2">
                {termsLabel}
              </Typography>
            }
          />

          <CustomIconLoadingButton
            type="submit"
            styles={primaryButtonStyles}
            textColor="#ffffff"
            disabled={!email || !termsChecked || isPending || !isValidEmail}
            text="Generate Console OTP"
            loading={isPending}
            loadingText="Generating..."
          />
        </Stack>
      </Box>
    ) : (
      <OtpForm
        email={email}
        visibleOtp={visibleOtp}
        onVisibleOtpChange={setVisibleOtp}
        onEditEmail={() => {
          setVisibleOtp(null)
          setStep(0)
        }}
      />
  )

  return (
    <Stack spacing={2.2} alignItems="stretch">
      <Stack spacing={1.2} alignItems="center">
        <Box
          component="img"
          src="/brand/intelExpress-logo.png"
          alt="IntleExpress"
          sx={{
            width: { xs: 148, sm: 168 },
            height: 'auto',
            mb: 0.4,
          }}
        />

        <Typography
          sx={{
            fontSize: '1.05rem',
            fontWeight: 800,
            color: '#17171A',
            letterSpacing: '-0.01em',
            textAlign: 'center',
          }}
        >
          Sign in with on-screen demo OTP
        </Typography>
      </Stack>

      <Box
        sx={{
          border: '1px solid rgba(17,17,19,0.08)',
          background: '#fff',
        }}
      >
        <Box sx={{ p: { xs: 1.3, sm: 1.6 } }}>
          {renderOtpEntry()}
        </Box>
      </Box>

      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: { xs: 'flex-start', sm: 'center' },
          gap: 1.2,
          flexDirection: { xs: 'column', sm: 'row' },
        }}
      >
        <Typography sx={{ fontSize: '0.8rem', color: '#6E6763', lineHeight: 1.6 }}>
          Need account policy details before signing in?
        </Typography>
        <CustomIconLoadingButton
          styles={secondaryButtonStyles}
          onClick={() => setOpenTerms(true)}
          variant="text"
          text="View Terms and Policies"
        />
      </Box>

      <CustomModal
        open={openTerms}
        onClose={() => setOpenTerms(false)}
        title="Terms and Conditions"
      >
        <Typography
          variant="body2"
          sx={{
            whiteSpace: 'pre-line',
            maxHeight: '60vh',
            overflowY: 'auto',
            pr: 1,
          }}
        >
          {TERMS_AND_CONDITIONS}
        </Typography>
      </CustomModal>
    </Stack>
  )
}
