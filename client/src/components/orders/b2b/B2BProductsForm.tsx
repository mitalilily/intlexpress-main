import {
  Box,
  Button,
  CircularProgress,
  IconButton,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import { useState } from 'react'
import { Controller, useFieldArray, useFormContext, useWatch } from 'react-hook-form'
import { AiOutlineDelete } from 'react-icons/ai'
import { MdContentCopy } from 'react-icons/md'
import axiosInstance from '../../../api/axiosInstance'
import { useDebouncedEffect } from '../../../hooks/useDebounceEffect'
import CustomInput from '../../UI/inputs/CustomInput'
import type { B2BFormData } from './B2BOrderForm'

const ProductBoxesForm = () => {
  const { control, setValue, trigger, watch } = useFormContext<B2BFormData>()
  const [weightCalculations, setWeightCalculations] = useState<{
    totalChargeableWeight: number
    cftFactor: number
    loading: boolean
  }>({
    totalChargeableWeight: 0,
    cftFactor: 4500,
    loading: false,
  })

  // Ensure boxes array exists
  const boxes = useWatch({ control, name: 'boxes' })
  if (!boxes || boxes.length === 0) {
    setValue('boxes', [
      {
        lengthCm: 0,
        breadthCm: 0,
        heightCm: 0,
        weightKg: 0,
      },
    ])
  }

  const {
    fields: boxFields,
    append: appendBox,
    remove: removeBox,
  } = useFieldArray({
    control,
    name: 'boxes',
  })

  // Watch pickup and delivery pincodes for rate calculation
  const pickupPincode = watch('pickupLocationPincode')
  const deliveryPincode = watch('pincode')
  // planId might not be in form, so we'll use undefined
  const planId = undefined

  // Calculate weight from backend using rate calculation API with debounce
  useDebouncedEffect(
    () => {
      const calculateWeights = async () => {
        // Need at least one box with dimensions
        if (!boxes || boxes.length === 0) {
          return
        }

        // Check if we have at least one box with valid dimensions
        const hasValidBox = boxes.some(
          (box) =>
            Number(box.lengthCm || 0) > 0 &&
            Number(box.breadthCm || 0) > 0 &&
            Number(box.heightCm || 0) > 0,
        )

        if (!hasValidBox) {
          // If no dimensions, use total actual weight as chargeable weight
          const totalActual = boxes.reduce((sum, box) => sum + Number(box.weightKg || 0), 0)
          setWeightCalculations({
            totalChargeableWeight: totalActual,
            cftFactor: 4500,
            loading: false,
          })
          return
        }

        setWeightCalculations((prev) => ({ ...prev, loading: true }))

        try {
          const normalizedBoxes = boxes.map((box) => ({
            lengthCm: Number(box.lengthCm || 0),
            breadthCm: Number(box.breadthCm || 0),
            heightCm: Number(box.heightCm || 0),
            weightKg: Number(box.weightKg || 0),
          }))
          const totalActualWeight = normalizedBoxes.reduce((sum, box) => sum + box.weightKg, 0)

          // Call backend to get chargeable weight
          // Use default pincodes if not available (for weight calculation only)
          const apiPayload: {
            originPincode: string
            destinationPincode: string
            weightKg: number
            length?: number
            width?: number
            height?: number
            planId?: string
            boxes?: typeof normalizedBoxes
          } = {
            originPincode: pickupPincode || '110001',
            destinationPincode: deliveryPincode || '110001',
            weightKg: totalActualWeight,
            boxes: normalizedBoxes,
          }
          // planId is always undefined for now, so we skip it

          const response = await axiosInstance.post('/admin/b2b/calculate-rate', apiPayload)

          if (response.data?.data) {
            const calc = response.data.data.calculation || {}
            const config = response.data.data.config || {}

            // Get chargeable weight from backend (billableWeight)
            const totalChargeableWeight = Number(calc.billableWeight || totalActualWeight)
            const cftFactor = Number(config.cftFactor || calc.cftFactor || 4500)

            setWeightCalculations({
              totalChargeableWeight,
              cftFactor,
              loading: false,
            })
          } else {
            // Fallback if API response structure is different
            setWeightCalculations({
              totalChargeableWeight: totalActualWeight,
              cftFactor: 4500,
              loading: false,
            })
          }
        } catch (error: unknown) {
          console.error('Error calculating weights from backend:', error)
          // Fallback if API fails - calculate locally
          const totalActual = boxes.reduce((sum, box) => sum + Number(box.weightKg || 0), 0)

          // Calculate volumetric weight locally as fallback
          let totalVolume = 0
          boxes.forEach((box) => {
            const length = Number(box.lengthCm || 0)
            const breadth = Number(box.breadthCm || 0)
            const height = Number(box.heightCm || 0)
            if (length > 0 && breadth > 0 && height > 0) {
              totalVolume += (length * breadth * height) / 4500
            }
          })

          const totalChargeableWeight = Math.max(totalActual, totalVolume)

          setWeightCalculations({
            totalChargeableWeight,
            cftFactor: 4500,
            loading: false,
          })
        }
      }

      calculateWeights()
    },
    [boxes, pickupPincode, deliveryPincode, planId],
    500, // 500ms debounce delay
  )

  const columns: { name: keyof B2BFormData['boxes'][0]; label: string; type: 'text' | 'number' }[] =
    [
      { name: 'lengthCm', label: 'Length (cm)', type: 'number' },
      { name: 'breadthCm', label: 'Breadth (cm)', type: 'number' },
      { name: 'heightCm', label: 'Height (cm)', type: 'number' },
      { name: 'weightKg', label: 'Weight (kg)', type: 'number' },
    ]

  // Function to check if last row is valid
  const canAddNewRow = async () => {
    const lastIndex = boxFields.length - 1
    if (lastIndex < 0) return true

    const valid = await trigger(columns.map((col) => `boxes.${lastIndex}.${col.name}` as const))
    return valid
  }

  const handleAddBox = async () => {
    const valid = await canAddNewRow()
    if (!valid) return

    appendBox({
      lengthCm: 0,
      breadthCm: 0,
      heightCm: 0,
      weightKg: 0,
    })
  }

  const handleDuplicateBox = (index: number) => {
    const sourceBox = allBoxes[index]
    appendBox({
      lengthCm: Number(sourceBox?.lengthCm || 0),
      breadthCm: Number(sourceBox?.breadthCm || 0),
      heightCm: Number(sourceBox?.heightCm || 0),
      weightKg: Number(sourceBox?.weightKg || 0),
    })
  }

  const allBoxes = useWatch({ control, name: 'boxes' }) || []

  return (
    <Box mt={2}>
      <Paper
        elevation={0}
        sx={{
          p: 2,
          mb: 2,
          borderRadius: 2,
          border: '1px solid #E0E6ED',
          background: '#F8FAFC',
        }}
      >
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
          <Controller
            name="freightMode"
            control={control}
            render={({ field }) => (
              <TextField {...field} select fullWidth label="Freight Mode" size="small">
                <MenuItem value="bill_to_client">Bill to client</MenuItem>
                <MenuItem value="freight_on_delivery">Freight on delivery</MenuItem>
              </TextField>
            )}
          />
          <Controller
            name="rovType"
            control={control}
            render={({ field }) => (
              <TextField {...field} select fullWidth label="ROV Type" size="small">
                <MenuItem value="owner_risk">ROV by owner</MenuItem>
                <MenuItem value="carrier_risk">ROV by courier</MenuItem>
              </TextField>
            )}
          />
        </Stack>
      </Paper>

      {/* Table Header */}
      <Box display="grid" gridTemplateColumns="repeat(5, 1fr)" gap={2} mb={1}>
        {columns.map((col) => (
          <Typography key={col.name} fontWeight="bold">
            {col.label}
          </Typography>
        ))}
        <Typography fontWeight="bold">Action</Typography>
      </Box>

      {/* Box Rows */}
      {boxFields.map((box, bIndex) => (
        <Box key={box.id} display="grid" gridTemplateColumns="repeat(5, 1fr)" gap={2} mb={1}>
          {columns.map((col) => (
            <Controller
              key={`${box.id}-${col.name}`}
              name={`boxes.${bIndex}.${col.name}` as const}
              control={control}
              rules={{
                required: `${col.label} is required`,
                min:
                  col.type === 'number' ? { value: 0, message: 'Cannot be negative' } : undefined,
              }}
              render={({ field, fieldState }) => (
                <CustomInput
                  {...field}
                  fullWidth
                  type={col.type}
                  error={!!fieldState.error}
                  helperText={fieldState.error?.message}
                />
              )}
            />
          ))}

          <Stack direction="row" alignItems="center" spacing={0.5} sx={{ mb: 4 }}>
            <IconButton color="primary" onClick={() => handleDuplicateBox(bIndex)}>
              <MdContentCopy />
            </IconButton>
            <IconButton
              color="error"
              onClick={() => (boxFields.length > 1 ? removeBox(bIndex) : undefined)}
              disabled={boxFields.length <= 1}
            >
              <AiOutlineDelete />
            </IconButton>
          </Stack>
        </Box>
      ))}

      {/* Add Box Button */}
      <Box mt={1}>
        <Button variant="outlined" onClick={handleAddBox}>
          + Add another box
        </Button>
      </Box>

      {/* Total Weight Summary Section */}
      {allBoxes.length > 0 && (
        <Paper
          sx={{
            p: 3,
            mt: 3,
            borderRadius: 3,
            border: '1px solid #E0E6ED',
            background: '#FFFFFF',
            boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
            position: 'relative',
            '&::before': {
              content: '""',
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              height: '4px',
              background: 'linear-gradient(90deg, #333d81 0%, #3DD598 100%)',
              borderRadius: '12px 12px 0 0',
            },
          }}
          elevation={0}
        >
          <Box
            sx={{
              p: 2,
              borderRadius: 2,
              background: '#F5F7FA',
              border: '1px solid #E0E6ED',
            }}
          >
            <Stack spacing={1.5}>
              <Stack direction="row" alignItems="center" justifyContent="space-between">
                <Typography variant="body2" fontWeight={600} color="#333d81">
                  Chargeable Weight
                </Typography>
                {weightCalculations.loading ? (
                  <CircularProgress size={20} />
                ) : (
                  <Typography variant="h6" fontWeight={700} color="#333d81">
                    {weightCalculations.totalChargeableWeight.toFixed(2)} kg
                  </Typography>
                )}
              </Stack>
              <Typography variant="caption" color="#4A5568">
                Formula: max(Actual Weight, Volumetric Weight) | Volumetric = (L×B×H) ÷{' '}
                {weightCalculations.cftFactor}
              </Typography>
            </Stack>
          </Box>
        </Paper>
      )}
    </Box>
  )
}

export default ProductBoxesForm
