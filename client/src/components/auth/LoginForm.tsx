import { Box, Chip, Divider, Stack, Typography } from '@mui/material'
import { Fragment } from 'react'
import { FiArrowRight, FiClock, FiMapPin, FiPackage, FiShield, FiTruck } from 'react-icons/fi'
import BrandMark from '../brand/BrandMark'
import { brand } from '../../theme/brand'
import PhoneForm from './PhoneForm'

const BRAND_BLUE = brand.colors.primary

export default function LoginForm() {
  return (
    <Box
      sx={{
        minHeight: '100vh',
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        overflow: 'hidden',
        background:
          'radial-gradient(circle at 14% 18%, rgba(206, 40, 38, 0.18) 0%, transparent 22%), radial-gradient(circle at 82% 22%, rgba(91, 102, 177, 0.16) 0%, transparent 24%), linear-gradient(135deg, #08111f 0%, #0f1730 45%, #f5f7fb 45%, #eef2f9 100%)',
        px: { xs: 2, sm: 3 },
        py: { xs: 3, sm: 4 },
        '&::before': {
          content: '""',
          position: 'absolute',
          inset: 0,
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px)',
          backgroundSize: '42px 42px',
          maskImage: 'linear-gradient(180deg, rgba(0,0,0,0.65), transparent 90%)',
          pointerEvents: 'none',
        },
      }}
    >
      <Box
        sx={{
          width: '100%',
          maxWidth: 1100,
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: '1.05fr 0.95fr' },
          gap: { xs: 0, md: 0 },
          background: 'rgba(255,255,255,0.88)',
          border: '1px solid rgba(255,255,255,0.45)',
          borderRadius: { xs: '28px', md: '36px' },
          boxShadow: '0 30px 90px rgba(4, 10, 29, 0.25)',
          overflow: 'hidden',
          backdropFilter: 'blur(14px)',
        }}
      >
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            px: { xs: 2.5, sm: 4, md: 5.5 },
            py: { xs: 4.5, md: 6.5 },
            background:
              'linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(248,250,255,0.96) 100%)',
          }}
        >
          <Stack spacing={2.5}>
            <Box>
              <BrandMark width={210} sx={{ mb: 2.25, maxWidth: '100%' }} />

              <Chip
                label="Courier control tower"
                size="small"
                sx={{
                  bgcolor: 'rgba(51,61,129,0.08)',
                  color: BRAND_BLUE,
                  fontWeight: 800,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  mb: 1.6,
                }}
              />

              <Typography
                sx={{
                  color: '#0f172a',
                  fontWeight: 800,
                  fontSize: { xs: '1.8rem', sm: '2.15rem' },
                  letterSpacing: '-0.03em',
                  lineHeight: 1.08,
                  mb: 1,
                }}
              >
                One secure sign-in for every shipment moving through Intlexpress.
              </Typography>

              <Typography
                sx={{
                  color: '#5c6781',
                  fontSize: '0.97rem',
                  lineHeight: 1.7,
                  maxWidth: 520,
                }}
              >
                Track parcels, manage billing, and keep dispatch moving from a dashboard built for
                courier teams.
              </Typography>
            </Box>

            <PhoneForm />
          </Stack>
        </Box>

        <Box
          sx={{
            position: 'relative',
            overflow: 'hidden',
            minHeight: { xs: 390, md: 700 },
            background:
              'linear-gradient(160deg, #0b1224 0%, #101b3a 52%, #18264f 100%)',
          }}
        >
          <Box
            sx={{
              position: 'relative',
              height: '100%',
              p: { xs: 3, sm: 4, md: 5 },
              color: '#f8fbff',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              gap: 2.5,
              '&::before': {
                content: '""',
                position: 'absolute',
                inset: 0,
                background:
                  'radial-gradient(circle at 20% 15%, rgba(206,40,38,0.35) 0%, transparent 20%), radial-gradient(circle at 80% 20%, rgba(91,102,177,0.22) 0%, transparent 22%), radial-gradient(circle at 70% 78%, rgba(255,255,255,0.08) 0%, transparent 22%)',
                pointerEvents: 'none',
              },
              '&::after': {
                content: '""',
                position: 'absolute',
                inset: 18,
                border: '1px solid rgba(255,255,255,0.12)',
                borderRadius: 4,
                pointerEvents: 'none',
              },
            }}
          >
            <Stack spacing={1.4} sx={{ position: 'relative', zIndex: 1 }}>
              <Typography
                sx={{
                  fontSize: '0.72rem',
                  letterSpacing: '0.22em',
                  textTransform: 'uppercase',
                  color: 'rgba(255,255,255,0.7)',
                  fontWeight: 800,
                }}
              >
                Dispatch Network
              </Typography>
              <Typography
                sx={{
                  fontSize: { xs: '1.9rem', sm: '2.45rem' },
                  fontWeight: 800,
                  lineHeight: 1.05,
                  letterSpacing: '-0.04em',
                  maxWidth: 460,
                }}
              >
                Keep parcels moving. Keep merchants in control.
              </Typography>
              <Typography
                sx={{
                  color: 'rgba(255,255,255,0.72)',
                  lineHeight: 1.8,
                  maxWidth: 500,
                }}
              >
                The login experience now mirrors the work you do every day: live hubs, fast lanes,
                route visibility, and a secure control panel for the people running the network.
              </Typography>
            </Stack>

            <Stack
              direction={{ xs: 'column', sm: 'row' }}
              spacing={1.2}
              sx={{ position: 'relative', zIndex: 1, flexWrap: 'wrap' }}
            >
              {[
                { icon: FiTruck, label: 'Live dispatch' },
                { icon: FiPackage, label: 'Shipment tracking' },
                { icon: FiShield, label: 'Secure access' },
              ].map(({ icon: Icon, label }) => (
                <Chip
                  key={label}
                  icon={<Icon size={14} />}
                  label={label}
                  sx={{
                    bgcolor: 'rgba(255,255,255,0.08)',
                    color: '#fff',
                    border: '1px solid rgba(255,255,255,0.12)',
                    px: 0.5,
                    py: 2.2,
                    '& .MuiChip-icon': { color: '#fff' },
                  }}
                />
              ))}
            </Stack>

            <Box
              sx={{
                position: 'relative',
                zIndex: 1,
                display: 'grid',
                gap: 1.4,
              }}
            >
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: '1fr auto 1fr auto 1fr',
                  alignItems: 'center',
                  gap: 1,
                  color: '#fff',
                }}
              >
                {[
                  {
                    title: 'Pickup scan',
                    text: 'Manifest accepted in 12 sec',
                    icon: FiMapPin,
                  },
                  {
                    title: 'Hub transfer',
                    text: 'Route matched to fastest lane',
                    icon: FiArrowRight,
                  },
                  {
                    title: 'Last mile',
                    text: 'ETA updated in real time',
                    icon: FiClock,
                  },
                ].map((item, index) => {
                  const Icon = item.icon
                  return (
                    <Fragment key={item.title}>
                      <Box
                        sx={{
                          p: 2,
                          borderRadius: 3,
                          background:
                            index === 1
                              ? 'linear-gradient(180deg, rgba(206,40,38,0.22), rgba(206,40,38,0.08))'
                              : 'rgba(255,255,255,0.06)',
                          border: '1px solid rgba(255,255,255,0.12)',
                          minHeight: 104,
                        }}
                      >
                        <Box
                          sx={{
                            width: 36,
                            height: 36,
                            borderRadius: '50%',
                            display: 'grid',
                            placeItems: 'center',
                            background: 'rgba(255,255,255,0.12)',
                            mb: 1.1,
                          }}
                        >
                          <Icon size={16} />
                        </Box>
                        <Typography sx={{ fontWeight: 800, mb: 0.4 }}>{item.title}</Typography>
                        <Typography sx={{ color: 'rgba(255,255,255,0.72)', fontSize: '0.9rem' }}>
                          {item.text}
                        </Typography>
                      </Box>
                      {index < 2 && (
                        <Box
                          sx={{
                            height: 2,
                            width: 26,
                            borderRadius: 999,
                            bgcolor: 'rgba(255,255,255,0.25)',
                          }}
                        />
                      )}
                    </Fragment>
                  )
                })}
              </Box>

              <Divider sx={{ borderColor: 'rgba(255,255,255,0.12)' }} />

              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, 1fr)' },
                  gap: 1.2,
                }}
              >
                {[
                  ['24/7', 'dispatch monitoring'],
                  ['150+', 'routes mapped'],
                  ['99.9%', 'shipment visibility'],
                ].map(([value, label]) => (
                  <Box
                    key={label}
                    sx={{
                      p: 2,
                      borderRadius: 3,
                      background: 'rgba(255,255,255,0.06)',
                      border: '1px solid rgba(255,255,255,0.1)',
                    }}
                  >
                    <Typography sx={{ fontSize: '1.35rem', fontWeight: 900, lineHeight: 1 }}>
                      {value}
                    </Typography>
                    <Typography sx={{ color: 'rgba(255,255,255,0.68)', mt: 0.5, fontSize: '0.92rem' }}>
                      {label}
                    </Typography>
                  </Box>
                ))}
              </Box>
            </Box>

            <Typography
              sx={{
                position: 'relative',
                zIndex: 1,
                fontSize: '0.78rem',
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                color: 'rgba(255,255,255,0.55)',
              }}
            >
              Built for dispatch teams, merch ops, and logistics control rooms.
            </Typography>
          </Box>
        </Box>
      </Box>
    </Box>
  )
}
