import { Grid, Tooltip } from '@mui/material'
import { useEffect, useState } from 'react'
import { Controller, useFormContext } from 'react-hook-form'
import { FaSync } from 'react-icons/fa'
import { checkOrderNumberAvailability } from '../../../api/order.service'
import CustomDatePicker from '../../UI/inputs/CustomDatePicker'
import CustomInput from '../../UI/inputs/CustomInput'
import type { B2CFormData } from './B2COrderForm'

const getTodayDate = () => new Date().toISOString().split('T')[0]
const generateReverseOrderId = () => `REV-${Date.now()}`

export default function ReverseOrderDetailsForm() {
  const {
    control,
    clearErrors,
    setError,
    setValue,
    watch,
    formState: { errors },
  } = useFormContext<B2CFormData>()
  const [orderIdStatus, setOrderIdStatus] = useState<
    'idle' | 'checking' | 'available' | 'unavailable' | 'error'
  >('idle')
  const [lastCheckedOrderId, setLastCheckedOrderId] = useState('')

  const currentOrderId = String(watch('orderId') || '').trim()
  const currentOrderDate = String(watch('orderDate') || '').trim()

  useEffect(() => {
    if (!currentOrderId || !currentOrderId.startsWith('REV-')) {
      setValue('orderId', generateReverseOrderId(), {
        shouldDirty: !currentOrderId,
      })
    }

    if (!currentOrderDate) {
      setValue('orderDate', getTodayDate())
    }
  }, [currentOrderDate, currentOrderId, setValue])

  useEffect(() => {
    if (!currentOrderId) {
      setOrderIdStatus('idle')
      setLastCheckedOrderId('')
      return
    }

    let cancelled = false
    const timer = window.setTimeout(async () => {
      setOrderIdStatus('checking')
      try {
        const response = await checkOrderNumberAvailability(currentOrderId)
        if (cancelled) return

        const available = Boolean(response?.data?.available)
        setLastCheckedOrderId(currentOrderId)
        setOrderIdStatus(available ? 'available' : 'unavailable')

        if (available) {
          if (errors?.orderId?.type === 'duplicate') {
            clearErrors('orderId')
          }
          return
        }

        setError('orderId', {
          type: 'duplicate',
          message: response?.data?.message || 'This reverse order number is already used.',
        })
      } catch {
        if (cancelled) return
        setLastCheckedOrderId(currentOrderId)
        setOrderIdStatus('error')
      }
    }, 350)

    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [clearErrors, currentOrderId, errors?.orderId?.type, setError])

  const orderIdHelperText =
    (errors?.orderId?.message as string) ||
    (currentOrderId && orderIdStatus === 'checking'
      ? 'Checking reverse order number...'
      : currentOrderId && orderIdStatus === 'available' && lastCheckedOrderId === currentOrderId
        ? 'Reverse order number is available.'
        : currentOrderId && orderIdStatus === 'error' && lastCheckedOrderId === currentOrderId
          ? 'Could not verify right now. Final duplicate check will run on submit.'
          : 'Use a unique reverse pickup number.')

  return (
    <Grid container spacing={0.65}>
      <Grid size={{ xs: 12, md: 4 }}>
        <Controller
          name="orderId"
          control={control}
          rules={{ required: 'Reverse order number is required' }}
          render={({ field }) => (
            <CustomInput
              label="Reverse Order Number"
              required
              {...field}
              error={!!errors?.orderId || orderIdStatus === 'unavailable'}
              helperText={orderIdHelperText}
              topMargin={false}
              dense
              postfix={
                <Tooltip title="Regenerate reverse order number">
                  <FaSync
                    style={{ cursor: 'pointer' }}
                    onClick={() =>
                      setValue('orderId', generateReverseOrderId(), {
                        shouldDirty: true,
                        shouldTouch: true,
                        shouldValidate: true,
                      })
                    }
                    size={12}
                  />
                </Tooltip>
              }
            />
          )}
        />
      </Grid>

      <Grid size={{ xs: 12, md: 4 }}>
        <Controller
          name="orderDate"
          control={control}
          rules={{ required: 'Order date is required' }}
          render={({ field }) => (
            <CustomDatePicker
              label="Return Request Date"
              {...field}
              error={!!errors?.orderDate}
              helperText={errors?.orderDate?.message as string}
              topMargin={false}
              dense
            />
          )}
        />
      </Grid>

      <Grid size={{ xs: 12, md: 4 }}>
        <Controller
          name="referenceNumber"
          control={control}
          render={({ field }) => (
            <CustomInput
              label="Reference Number / Original AWB"
              {...field}
              helperText="Optional. Use the original shipment AWB or channel reference."
              topMargin={false}
              dense
            />
          )}
        />
      </Grid>
    </Grid>
  )
}
