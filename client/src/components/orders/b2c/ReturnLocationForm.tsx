import { Box, Grid, MenuItem, Paper, Stack, TextField, Typography, alpha } from '@mui/material'
import { useEffect, useMemo } from 'react'
import { Controller, useFormContext } from 'react-hook-form'
import { usePickupAddresses } from '../../../hooks/Pickup/usePickupAddresses'
import { getDefaultPickupSlot } from '../../../utils/pickupSchedule'
import type { B2CFormData } from './B2COrderForm'

const ACCENT = '#333d81'
const TEXT_PRIMARY = '#17171A'
const TEXT_MUTED = '#496189'

type PickupAddressRecord = {
  id: string
  pickupId: string
  isPrimary?: boolean
  pickup?: {
    addressNickname?: string
    addressLine1?: string
    addressLine2?: string
    city?: string
    state?: string
    pincode?: string
    contactName?: string
    contactPhone?: string
  }
}

export default function ReturnLocationForm() {
  const { control, setValue, watch } = useFormContext<B2CFormData>()
  const { data, isLoading, isError } = usePickupAddresses({
    isPickupEnabled: 'active' as unknown as boolean,
  })

  const pickupAddresses = useMemo(
    () => ((data?.pickupAddresses || []) as PickupAddressRecord[]).filter((item) => item?.pickupId),
    [data?.pickupAddresses],
  )

  const selectedPickupLocationId = String(watch('pickupLocationId') || '')
  const pickupDate = watch('pickupDate')
  const pickupTime = watch('pickupTime')

  const applyPickupLocation = (location?: PickupAddressRecord) => {
    if (!location) return

    setValue('pickupLocationId', location.pickupId, { shouldDirty: true, shouldValidate: true })
    setValue('pickupLocationPincode', location.pickup?.pincode || '', { shouldDirty: true })
    setValue('pickupLocationName', location.pickup?.addressNickname || '', { shouldDirty: true })
    setValue('pickupLocationPOCName', location.pickup?.contactName || '', { shouldDirty: true })
    setValue('pickupLocationPOCPhone', location.pickup?.contactPhone || '', { shouldDirty: true })
    setValue(
      'pickupAddress',
      [location.pickup?.addressLine1, location.pickup?.addressLine2].filter(Boolean).join(', '),
      { shouldDirty: true },
    )
    setValue('pickupCity', location.pickup?.city || '', { shouldDirty: true })
    setValue('pickupState', location.pickup?.state || '', { shouldDirty: true })
    setValue('isRtoSame', true, { shouldDirty: true })
    setValue('rtoLocationPincode', location.pickup?.pincode || '', { shouldDirty: true })
    setValue('rtoLocationName', location.pickup?.addressNickname || '', { shouldDirty: true })
    setValue('rtoLocationPOCName', location.pickup?.contactName || '', { shouldDirty: true })
    setValue('rtoLocationPOCPhone', location.pickup?.contactPhone || '', { shouldDirty: true })
    setValue(
      'rtoAddress',
      [location.pickup?.addressLine1, location.pickup?.addressLine2].filter(Boolean).join(', '),
      { shouldDirty: true },
    )
    setValue('rtoCity', location.pickup?.city || '', { shouldDirty: true })
    setValue('rtoState', location.pickup?.state || '', { shouldDirty: true })
  }

  useEffect(() => {
    const defaultPickupSlot = getDefaultPickupSlot()
    if (!pickupDate) {
      setValue('pickupDate', defaultPickupSlot.pickupDate)
    }
    if (!pickupTime) {
      setValue('pickupTime', defaultPickupSlot.pickupTime)
    }
  }, [pickupDate, pickupTime, setValue])

  useEffect(() => {
    if (!pickupAddresses.length) return

    const matchingLocation = pickupAddresses.find((item) => item.pickupId === selectedPickupLocationId)
    if (matchingLocation) {
      applyPickupLocation(matchingLocation)
      return
    }

    const fallbackLocation =
      pickupAddresses.find((item) => item.isPrimary) || pickupAddresses[0]

    applyPickupLocation(fallbackLocation)
  }, [pickupAddresses, selectedPickupLocationId])

  const selectedLocation =
    pickupAddresses.find((item) => item.pickupId === selectedPickupLocationId) || null

  if (isLoading) {
    return <Typography color="text.secondary">Loading return locations...</Typography>
  }

  if (isError || !pickupAddresses.length) {
    return (
      <Typography color="error">
        Add at least one pickup location to use it as the reverse return address.
      </Typography>
    )
  }

  return (
    <Stack spacing={0.9}>
      <Controller
        name="pickupLocationId"
        control={control}
        rules={{ required: 'Return location is required' }}
        render={({ field, fieldState }) => (
          <TextField
            select
            label="Select Return Location"
            fullWidth
            size="small"
            value={field.value || ''}
            onChange={(event) => {
              const nextLocation =
                pickupAddresses.find((item) => item.pickupId === event.target.value) || null
              field.onChange(event.target.value)
              applyPickupLocation(nextLocation || undefined)
            }}
            error={!!fieldState.error}
            helperText={fieldState.error?.message || 'This is where the reverse shipment will be delivered.'}
          >
            {pickupAddresses.map((item) => (
              <MenuItem key={item.pickupId} value={item.pickupId}>
                {item.pickup?.addressNickname || 'Pickup Location'} - {item.pickup?.pincode || '-'}
              </MenuItem>
            ))}
          </TextField>
        )}
      />

      {selectedLocation && (
        <Paper
          elevation={0}
          sx={{
            p: 1,
            borderRadius: 2,
            border: `1px solid ${alpha(ACCENT, 0.14)}`,
            background: alpha(ACCENT, 0.03),
          }}
        >
          <Stack spacing={0.45}>
            <Typography sx={{ fontWeight: 700, color: TEXT_PRIMARY, fontSize: '0.82rem' }}>
              {selectedLocation.pickup?.addressNickname || 'Return warehouse'}
            </Typography>
            <Typography sx={{ color: TEXT_MUTED, fontSize: '0.74rem' }}>
              {[selectedLocation.pickup?.addressLine1, selectedLocation.pickup?.addressLine2]
                .filter(Boolean)
                .join(', ') || '-'}
            </Typography>
            <Typography sx={{ color: TEXT_MUTED, fontSize: '0.74rem' }}>
              {[selectedLocation.pickup?.city, selectedLocation.pickup?.state, selectedLocation.pickup?.pincode]
                .filter(Boolean)
                .join(', ') || '-'}
            </Typography>
            <Typography sx={{ color: TEXT_MUTED, fontSize: '0.74rem' }}>
              {selectedLocation.pickup?.contactName || '-'} | {selectedLocation.pickup?.contactPhone || '-'}
            </Typography>
          </Stack>
        </Paper>
      )}

      <Grid container spacing={0.65}>
        <Grid size={{ xs: 12, sm: 6 }}>
          <Controller
            name="pickupDate"
            control={control}
            rules={{ required: 'Pickup date is required' }}
            render={({ field, fieldState }) => (
              <TextField
                {...field}
                type="date"
                label="Preferred Pickup Date"
                size="small"
                fullWidth
                InputLabelProps={{ shrink: true }}
                error={!!fieldState.error}
                helperText={fieldState.error?.message}
              />
            )}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6 }}>
          <Controller
            name="pickupTime"
            control={control}
            rules={{ required: 'Pickup time is required' }}
            render={({ field, fieldState }) => (
              <TextField
                {...field}
                type="time"
                label="Preferred Pickup Time"
                size="small"
                fullWidth
                InputLabelProps={{ shrink: true }}
                error={!!fieldState.error}
                helperText={fieldState.error?.message || 'Use your local warehouse timezone.'}
              />
            )}
          />
        </Grid>
      </Grid>

      <Box
        sx={{
          px: 0.9,
          py: 0.75,
          borderRadius: 2,
          border: `1px dashed ${alpha(ACCENT, 0.28)}`,
          background: '#fff',
        }}
      >
        <Typography sx={{ color: TEXT_MUTED, fontSize: '0.74rem' }}>
          Reverse flow: courier picks up from the customer first, then delivers back to this return
          location.
        </Typography>
      </Box>
    </Stack>
  )
}
