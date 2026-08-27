import type { JSX } from '@emotion/react/jsx-runtime'
import {
  alpha,
  Avatar,
  Box,
  Card,
  CardContent,
  Chip,
  Divider,
  Grid,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material'
import { BiPackage, BiRupee, BiTimeFive } from 'react-icons/bi'
import { FaShippingFast, FaWeight } from 'react-icons/fa'
import { courierLogos } from '../utils/constants'

/* Types */
type ForwardRate = {
  mode?: string | null
  rate?: number | null
  cod_charges?: number | null
  cod_percent?: number | null
  other_charges?: number | null
  total_charges?: number | null
  charge_breakdown?: {
    baseFreight?: number | string | null
    overheads?: Array<{
      id?: string | null
      code?: string | null
      name?: string | null
      amount?: number | string | null
    }>
    demurrage?: number | string | null
    total?: number | string | null
    gstPercent?: number | string | null
    gstAmount?: number | string | null
    totalWithGst?: number | string | null
    origin?: { code?: string | null; name?: string | null } | null
    destination?: { code?: string | null; name?: string | null } | null
    calculation?: {
      actualWeight?: number | string | null
      volumetricWeight?: number | string | null
      billableWeight?: number | string | null
      usedVolumetric?: boolean | null
    }
  } | null
  chargeable_weight?: number | null
  volumetric_weight?: number | null
  is_prepaid?: boolean
  is_cod?: boolean
}

type LocalRates = {
  forward?: ForwardRate | null
}

export type Courier = {
  id: string
  courier_id?: string | number | null
  courier_option_key?: string | null
  name?: string | null
  chargeable_weight?: number | null
  volumetric_weight?: number | null
  slabs?: number | null
  rate?: number | null
  cod_charges?: number | null
  other_charges?: number | null
  total_charges?: number | null
  edd?: string | null
  localRates?: LocalRates | null
  special_zone?: boolean | null
  notes?: string | null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  approxZone: any
}

type Props = {
  availableCouriers?: Courier[]
  defaultLogo?: string
  onSelect?: (courier: Courier) => void
  shipmentType?: string
  shipmentCategory?: 'b2b' | 'b2c'
}

const ACCENT = '#333d81'
const TEXT_PRIMARY = '#17171A'
const TEXT_MUTED = '#496189'
const BORDER = '#E2E8F0'

const formatWeightDisplay = (value?: number | string | null) => {
  const grams = Number(value ?? 0)
  if (!Number.isFinite(grams) || grams <= 0) return '—'
  if (grams < 1000) return `${Math.round(grams).toLocaleString('en-IN')} g`
  return `${(grams / 1000).toFixed(2)} kg`
}

const formatKgDisplay = (value?: number | string | null) => {
  const kg = Number(value ?? 0)
  if (!Number.isFinite(kg) || kg <= 0) return '—'
  return `${kg.toFixed(2)} kg`
}

const formatCurrencyDisplay = (value?: number | string | null) => {
  const amount = Number(value ?? 0)
  if (!Number.isFinite(amount)) return '₹0'
  return `₹${amount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`
}

const getB2BChargeLines = (breakdown: ForwardRate['charge_breakdown']) => {
  if (!breakdown || typeof breakdown !== 'object') return []

  const lines: Array<{ label: string; amount: number; isTotal?: boolean }> = []
  const baseFreight = Number(breakdown.baseFreight ?? 0)
  if (baseFreight > 0) lines.push({ label: 'Base Freight', amount: baseFreight })

  const overheads = Array.isArray(breakdown.overheads) ? breakdown.overheads : []
  const ensureRow = (label: string, amount: number) => {
    if (!lines.some((line) => line.label === label)) lines.push({ label, amount: Math.max(0, amount) })
  }
  const hiddenChargeIds = new Set(['billing_start_date', 'reattempt_free_attempts', 'round_off'])
  overheads.forEach((overhead) => {
    const overheadId = String(overhead?.id || '').toLowerCase()
    const overheadName = String(overhead?.name || '').toLowerCase()
    if (
      hiddenChargeIds.has(overheadId) ||
      /billing\s*start|re[- ]?attempt\s*free|round\s*off/.test(overheadId) ||
      /billing\s*start|re[- ]?attempt\s*free|round\s*off/.test(overheadName)
    ) return
    const amount = Number(overhead?.amount ?? 0)
    if (amount > 0) {
      const rawLabel = String(overhead?.name || overhead?.code || 'Additional Charge')
      const label = /cash|cheque/i.test(rawLabel) ? 'Cash / Cheque Handling Charge' : rawLabel
      if (label === 'Cash / Cheque Handling Charge' && lines.some((line) => line.label === label)) return
      lines.push({
        label,
        amount,
      })
    }
  })
  ensureRow('Fuel Hike / DPH', Number(overheads.find((o) => String(o?.id) === 'fuel_hike_dph')?.amount ?? 0))

  const demurrage = Number(breakdown.demurrage ?? 0)
  if (demurrage > 0 && !overheads.some((overhead) => String(overhead?.id) === 'demurrage_charge')) {
    lines.push({ label: 'Demurrage', amount: demurrage })
  }

  ensureRow('ODA Charges', Number((breakdown as any).odaAmount ?? overheads.find((o) => String(o?.id) === 'oda_charge')?.amount ?? 0))
  ensureRow('Insurance Charge', Number(overheads.find((o) => String(o?.id) === 'rov_charge' || String(o?.id) === 'insurance_charge')?.amount ?? 0))
  ensureRow(`GST (${Number((breakdown as any).gstPercent ?? 18).toFixed(2)}%)`, Number((breakdown as any).gstAmount ?? 0))

  const total = Number((breakdown as any).totalWithGst ?? breakdown.total ?? 0)
  if (total >= 0) lines.push({ label: 'Total Booking Charge', amount: total, isTotal: true })

  return lines
}

export default function CourierRateList({
  availableCouriers = [],
  defaultLogo = '',
  onSelect,
  shipmentType,
  shipmentCategory,
}: Props): JSX.Element {
  if (!availableCouriers || availableCouriers.length === 0) {
    return (
      <Box
        py={8}
        display="flex"
        flexDirection="column"
        justifyContent="center"
        alignItems="center"
        sx={{
          background: '#FFFFFF',
          borderRadius: 4,
          border: `1px dashed ${alpha(ACCENT, 0.3)}`,
        }}
      >
        <Box
          sx={{
            width: 64,
            height: 64,
            borderRadius: '50%',
            background: alpha(ACCENT, 0.08),
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            mb: 2,
          }}
        >
          <FaShippingFast size={30} color={ACCENT} />
        </Box>
        <Typography
          variant="h6"
          sx={{
            fontWeight: 600,
            color: TEXT_PRIMARY,
            mb: 1,
          }}
        >
          No courier rates available
        </Typography>
        <Typography variant="body2" color={TEXT_MUTED} sx={{ textAlign: 'center', maxWidth: 400 }}>
          Please check your input parameters and try again
        </Typography>
      </Box>
    )
  }

  return (
    <Box mt={4}>
      <Typography
        variant="h5"
        sx={{
          fontWeight: 700,
          color: TEXT_PRIMARY,
          mb: 3,
          fontSize: { xs: '1.25rem', sm: '1.5rem' },
        }}
      >
        Available Couriers ({availableCouriers.length})
      </Typography>

      <Grid container spacing={3}>
        {availableCouriers?.map((courier) => {
          const logo =
            Object.entries(courierLogos || {}).find(([key]) =>
              courier?.name?.toLowerCase().includes(key.toLowerCase()),
            )?.[1] ?? defaultLogo

          const forward: ForwardRate = courier?.localRates?.forward ?? {}
          const chargeBreakdown = forward?.charge_breakdown ?? null
          const b2bChargeLines = getB2BChargeLines(chargeBreakdown)
          const shouldShowB2BBreakdown = shipmentCategory === 'b2b' && b2bChargeLines.length > 0
          const zoneDisplay =
            (forward?.charge_breakdown?.origin?.code && forward?.charge_breakdown?.destination?.code
              ? `${forward.charge_breakdown.origin.code} → ${forward.charge_breakdown.destination.code}`
              : '') ||
            String(courier?.approxZone?.name || '').trim() ||
            String(courier?.approxZone?.code || '').trim() ||
            String(
              (courier as any)?.zone_name || (courier as any)?.zone || (courier as any)?.zone_code || '',
            ).trim()
          const chargeableWeight = forward?.chargeable_weight ?? null
          const courierOptionKey = String(
            courier?.courier_option_key ?? courier?.id ?? courier?.courier_id ?? courier?.name ?? '',
          )

          // Calculate total charges using slabbed rate
          const freight =
            forward?.rate !== undefined && forward?.rate !== null
              ? Number(forward.rate)
              : courier?.rate !== undefined && courier?.rate !== null
              ? Number(courier.rate)
              : 0
          const isCOD = shipmentType === 'cod'
          const codCharges = isCOD ? Number(forward?.cod_charges ?? courier?.cod_charges ?? 0) : 0
          const otherCharges = Number(forward?.other_charges ?? courier?.other_charges ?? 0)
          const explicitTotal = forward?.total_charges ?? courier?.total_charges
          const totalCharges =
            explicitTotal !== undefined && explicitTotal !== null
              ? Number(explicitTotal)
              : freight + codCharges + otherCharges

          // Parse EDD
          const eddText = courier?.edd ?? '—'
          const isClickable = Boolean(onSelect)

          return (
            <Grid size={{ xs: 12, sm: 6, md: 4 }} key={courierOptionKey}>
              <Card
                onClick={isClickable ? () => onSelect?.(courier) : undefined}
                sx={{
                  height: '100%',
                  overflow: 'hidden',
                  borderRadius: 3,
                  border: `1px solid ${BORDER}`,
                  boxShadow: `0 2px 8px ${alpha('#000000', 0.05)}`,
                  transition: 'all 0.2s ease',
                  background: '#FFFFFF',
                  cursor: isClickable ? 'pointer' : 'default',
                  '&:hover': {
                    boxShadow: `0 10px 24px ${alpha(ACCENT, 0.1)}`,
                    borderColor: alpha(ACCENT, 0.28),
                  },
                }}
              >
                <Box
                  sx={{
                    height: 3,
                    background: alpha(ACCENT, 0.9),
                  }}
                />

                <CardContent sx={{ p: 3, '&:last-child': { pb: 3 } }}>
                  <Stack direction="row" spacing={2} alignItems="center" mb={2.5}>
                    <Avatar
                      src={logo}
                      alt={courier?.name ?? 'logo'}
                      variant="rounded"
                      sx={{
                        width: 56,
                        height: 56,
                        borderRadius: 2,
                        border: `1px solid ${alpha(ACCENT, 0.14)}`,
                      }}
                    />
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography
                        variant="subtitle1"
                        sx={{
                          fontWeight: 700,
                          color: TEXT_PRIMARY,
                          lineHeight: 1.3,
                          mb: 0.5,
                        }}
                        noWrap
                      >
                        {courier?.name ?? 'Unknown Courier'}
                      </Typography>
                      {zoneDisplay && (
                        <Chip
                          label={zoneDisplay}
                          size="small"
                          sx={{
                            height: 22,
                            fontSize: '0.7rem',
                            fontWeight: 600,
                            background: alpha(ACCENT, 0.08),
                            color: ACCENT,
                            border: `1px solid ${alpha(ACCENT, 0.2)}`,
                          }}
                        />
                      )}
                    </Box>
                  </Stack>

                  <Box
                    sx={{
                      background: alpha(ACCENT, 0.04),
                      borderRadius: 2,
                      p: 2,
                      mb: 2.5,
                      border: `1px solid ${alpha(ACCENT, 0.14)}`,
                    }}
                  >
                    <Stack direction="row" alignItems="baseline" spacing={1}>
                      <BiRupee size={20} color={ACCENT} />
                      <Typography
                        variant="h4"
                        sx={{
                          fontWeight: 800,
                          color: TEXT_PRIMARY,
                          fontSize: '2rem',
                          lineHeight: 1,
                        }}
                      >
                        {totalCharges > 0 ? totalCharges.toLocaleString('en-IN') : 'N/A'}
                      </Typography>
                    </Stack>
                    <Typography
                      variant="caption"
                      sx={{
                        color: TEXT_MUTED,
                        fontWeight: 500,
                        mt: 0.5,
                        display: 'block',
                      }}
                    >
                      {isCOD ? 'Including COD Charges' : 'Prepaid Rate'}
                    </Typography>
                  </Box>

                  {shouldShowB2BBreakdown && (
                    <Box
                      sx={{
                        borderRadius: 2,
                        p: 1.5,
                        mb: 2,
                        background: '#F8FAFC',
                        border: `1px solid ${BORDER}`,
                      }}
                    >
                      <Typography
                        variant="caption"
                        sx={{ color: TEXT_MUTED, fontWeight: 800, display: 'block', mb: 1 }}
                      >
                        Charge Breakup
                      </Typography>
                      <Stack spacing={0.75}>
                        {b2bChargeLines.map((line) => (
                          <Stack
                            key={line.label}
                            direction="row"
                            justifyContent="space-between"
                            sx={{
                              pt: line.isTotal ? 0.75 : 0,
                              borderTop: line.isTotal ? `1px solid ${alpha(ACCENT, 0.14)}` : 'none',
                            }}
                          >
                            <Typography
                              variant="caption"
                              sx={{
                                color: line.isTotal ? TEXT_PRIMARY : TEXT_MUTED,
                                fontWeight: line.isTotal ? 800 : 500,
                              }}
                            >
                              {line.label}
                            </Typography>
                            <Typography
                              variant="caption"
                              sx={{ color: TEXT_PRIMARY, fontWeight: line.isTotal ? 900 : 700 }}
                            >
                              {formatCurrencyDisplay(line.amount)}
                            </Typography>
                          </Stack>
                        ))}
                      </Stack>

                      {chargeBreakdown?.calculation && (
                        <>
                          <Divider sx={{ my: 1 }} />
                          <Grid container spacing={1}>
                            <Grid size={{ xs: 4 }}>
                              <Typography variant="caption" color={TEXT_MUTED}>
                                Actual
                              </Typography>
                              <Typography variant="caption" display="block" fontWeight={800}>
                                {formatKgDisplay(chargeBreakdown.calculation.actualWeight)}
                              </Typography>
                            </Grid>
                            <Grid size={{ xs: 4 }}>
                              <Typography variant="caption" color={TEXT_MUTED}>
                                Volumetric
                              </Typography>
                              <Typography variant="caption" display="block" fontWeight={800}>
                                {formatKgDisplay(chargeBreakdown.calculation.volumetricWeight)}
                              </Typography>
                            </Grid>
                            <Grid size={{ xs: 4 }}>
                              <Typography variant="caption" color={TEXT_MUTED}>
                                Billable
                              </Typography>
                              <Typography variant="caption" display="block" fontWeight={800}>
                                {formatKgDisplay(chargeBreakdown.calculation.billableWeight)}
                              </Typography>
                            </Grid>
                          </Grid>
                        </>
                      )}
                    </Box>
                  )}

                  {/* Details Grid */}
                  <Grid container spacing={1.5} mb={2}>
                    {/* EDD */}
                    <Grid size={{ xs: 6 }}>
                      <Stack
                        direction="row"
                        spacing={1}
                        alignItems="center"
                        sx={{
                          p: 1.5,
                          borderRadius: 1.5,
                          background: '#F8FAFC',
                          border: `1px solid ${BORDER}`,
                        }}
                      >
                        <BiTimeFive size={18} color={ACCENT} />
                        <Box>
                          <Typography
                            variant="caption"
                            sx={{
                              color: TEXT_MUTED,
                              fontSize: '0.7rem',
                              display: 'block',
                              lineHeight: 1.2,
                            }}
                          >
                            EDD
                          </Typography>
                          <Typography
                            variant="body2"
                            sx={{
                              fontWeight: 700,
                              color: TEXT_PRIMARY,
                              fontSize: '0.85rem',
                              lineHeight: 1.2,
                            }}
                          >
                            {eddText}
                          </Typography>
                        </Box>
                      </Stack>
                    </Grid>

                    {/* Chargeable Weight */}
                    <Grid size={{ xs: 6 }}>
                      <Stack
                        direction="row"
                        spacing={1}
                        alignItems="center"
                        sx={{
                          p: 1.5,
                          borderRadius: 1.5,
                          background: '#F8FAFC',
                          border: `1px solid ${BORDER}`,
                        }}
                      >
                        <FaWeight size={16} color={ACCENT} />
                        <Box>
                          <Typography
                            variant="caption"
                            sx={{
                              color: TEXT_MUTED,
                              fontSize: '0.7rem',
                              display: 'block',
                              lineHeight: 1.2,
                            }}
                          >
                            Weight
                          </Typography>
                          <Typography
                            variant="body2"
                            sx={{
                              fontWeight: 700,
                              color: TEXT_PRIMARY,
                              fontSize: '0.85rem',
                              lineHeight: 1.2,
                            }}
                          >
                            {formatWeightDisplay(chargeableWeight)}
                          </Typography>
                        </Box>
                      </Stack>
                    </Grid>
                  </Grid>

                  {/* Additional Info */}
                  <Stack spacing={1}>
                    {forward?.mode && (
                      <Stack direction="row" spacing={1} alignItems="center">
                        <BiPackage size={14} color={TEXT_MUTED} />
                        <Typography variant="caption" color={TEXT_MUTED} sx={{ fontSize: '0.75rem' }}>
                          Mode: <strong>{forward.mode}</strong>
                        </Typography>
                      </Stack>
                    )}
                    {isCOD && codCharges > 0 && (
                      <Stack direction="row" spacing={1} alignItems="center">
                        <BiRupee size={14} color={TEXT_MUTED} />
                        <Typography variant="caption" color={TEXT_MUTED} sx={{ fontSize: '0.75rem' }}>
                          COD Charges: <strong>₹{codCharges.toLocaleString('en-IN')}</strong>
                        </Typography>
                      </Stack>
                    )}
                    {courier?.notes && (
                      <Tooltip title={courier.notes} arrow>
                        <Chip
                          label="Special Notes"
                          size="small"
                          sx={{
                            height: 24,
                            fontSize: '0.7rem',
                            fontWeight: 500,
                            background: alpha(ACCENT, 0.08),
                            color: ACCENT,
                            border: `1px solid ${alpha(ACCENT, 0.2)}`,
                            cursor: 'help',
                            '&:hover': {
                              background: alpha(ACCENT, 0.12),
                            },
                          }}
                        />
                      </Tooltip>
                    )}
                  </Stack>
                </CardContent>
              </Card>
            </Grid>
          )
        })}
      </Grid>
    </Box>
  )
}
