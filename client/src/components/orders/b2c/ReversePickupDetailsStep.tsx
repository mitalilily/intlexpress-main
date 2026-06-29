import {
  Box,
  Checkbox,
  FormControlLabel,
  Grid,
  MenuItem,
  Stack,
  TextField,
  Typography,
  alpha,
} from '@mui/material'
import type { ReactNode } from 'react'
import {
  type Control,
  Controller,
  type UseFieldArrayAppend,
  type UseFieldArrayRemove,
  useFormContext,
} from 'react-hook-form'
import { FaBox, FaMapMarkedAlt, FaStickyNote, FaTruck, FaUser } from 'react-icons/fa'
import DeliveryDetailsForm from '../DeliveryDetailsForm'
import type { B2CFormData } from './B2COrderForm'
import PackageDetailsForm from './PackageDetailsForm'
import PackageDimensionsForm from './PackageDimensionsForm'
import ReturnLocationForm from './ReturnLocationForm'
import ReverseOrderDetailsForm from './ReverseOrderDetailsForm'

const ACCENT = '#333d81'
const TEXT_PRIMARY = '#17171A'
const TEXT_MUTED = '#496189'

const reverseReasonOptions = [
  { value: 'damaged', label: 'Damaged Item' },
  { value: 'wrong_item', label: 'Wrong Item Received' },
  { value: 'size_issue', label: 'Size / Fit Issue' },
  { value: 'quality_issue', label: 'Quality Issue' },
  { value: 'exchange', label: 'Exchange Request' },
  { value: 'other', label: 'Other' },
]

interface ReversePickupDetailsStepProps {
  control: Control<B2CFormData>
  fields: { id: string }[]
  remove: UseFieldArrayRemove
  append: UseFieldArrayAppend<B2CFormData, 'products'>
}

const SectionFrame = ({
  icon,
  title,
  children,
}: {
  icon: ReactNode
  title: string
  children: ReactNode
}) => (
  <Box>
    <Stack direction="row" alignItems="center" gap={0.6} sx={{ mb: 0.4 }}>
      <Box sx={{ color: ACCENT, display: 'grid', placeItems: 'center' }}>{icon}</Box>
      <Typography
        variant="subtitle1"
        fontWeight={700}
        sx={{ color: TEXT_PRIMARY, fontSize: '0.84rem' }}
      >
        {title}
      </Typography>
    </Stack>
    <Box
      sx={{
        px: { xs: 0.75, md: 0.9 },
        py: 0.65,
        borderRadius: 2,
        border: `1px solid ${alpha(ACCENT, 0.1)}`,
        background: '#f9f9f9',
      }}
    >
      {children}
    </Box>
  </Box>
)

export default function ReversePickupDetailsStep({
  control,
  fields,
  remove,
  append,
}: ReversePickupDetailsStepProps) {
  const { formState: { errors } } = useFormContext<B2CFormData>()

  return (
    <Stack gap={0.75} mb={0.75}>
      <SectionFrame icon={<FaTruck size={14} />} title="Reverse Order Details">
        <ReverseOrderDetailsForm />
      </SectionFrame>

      <Grid container spacing={0.75}>
        <Grid size={{ xs: 12, xl: 8 }}>
          <Stack gap={0.75}>
            <SectionFrame icon={<FaUser size={14} />} title="Customer Pickup Details">
              <DeliveryDetailsForm />
            </SectionFrame>

            <SectionFrame icon={<FaBox size={14} />} title="Item Details">
              <Stack spacing={0.7}>
                <Box>
                  <Typography
                    variant="body2"
                    fontWeight={700}
                    sx={{ color: TEXT_MUTED, mb: 0.45, display: 'block', fontSize: '0.74rem' }}
                  >
                    Reverse Order Items
                  </Typography>
                  <PackageDetailsForm
                    append={append}
                    control={control}
                    fields={fields}
                    remove={remove}
                    itemLabel="Return Item"
                    addButtonLabel="Add Return Item"
                  />
                </Box>

                <Controller
                  name="fragileShipment"
                  control={control}
                  render={({ field }) => (
                    <FormControlLabel
                      control={<Checkbox checked={Boolean(field.value)} onChange={(_, checked) => field.onChange(checked)} />}
                      label="My package contains fragile or liquid items"
                      sx={{
                        ml: 0,
                        '& .MuiFormControlLabel-label': {
                          fontSize: '0.82rem',
                          color: TEXT_PRIMARY,
                        },
                      }}
                    />
                  )}
                />
              </Stack>
            </SectionFrame>

            <SectionFrame icon={<FaStickyNote size={14} />} title="Other Details">
              <Grid container spacing={0.65}>
                <Grid size={{ xs: 12, md: 6 }}>
                  <Controller
                    name="returnReason"
                    control={control}
                    rules={{ required: 'Reason for return is required' }}
                    render={({ field }) => (
                      <TextField
                        {...field}
                        select
                        fullWidth
                        size="small"
                        label="Reason for Return"
                        error={!!errors.returnReason}
                        helperText={(errors.returnReason?.message as string) || 'Choose the return trigger.'}
                      >
                        {reverseReasonOptions.map((option) => (
                          <MenuItem key={option.value} value={option.value}>
                            {option.label}
                          </MenuItem>
                        ))}
                      </TextField>
                    )}
                  />
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                  <Controller
                    name="referenceNumber"
                    control={control}
                    render={({ field }) => (
                      <TextField
                        {...field}
                        fullWidth
                        size="small"
                        label="Reference Number"
                        helperText="Original AWB or marketplace return reference."
                      />
                    )}
                  />
                </Grid>
                <Grid size={12}>
                  <Controller
                    name="pickupNotes"
                    control={control}
                    render={({ field }) => (
                      <TextField
                        {...field}
                        fullWidth
                        size="small"
                        label="Notes for Field Executive"
                        multiline
                        minRows={3}
                        helperText="Optional instructions for pickup handling."
                      />
                    )}
                  />
                </Grid>
              </Grid>
            </SectionFrame>
          </Stack>
        </Grid>

        <Grid size={{ xs: 12, xl: 4 }}>
          <Stack gap={0.75} sx={{ position: { xl: 'sticky' }, top: 4 }}>
            <SectionFrame icon={<FaMapMarkedAlt size={14} />} title="Return Location">
              <ReturnLocationForm />
            </SectionFrame>

            <SectionFrame icon={<FaBox size={14} />} title="Box Details">
              <PackageDimensionsForm />
            </SectionFrame>
          </Stack>
        </Grid>
      </Grid>
    </Stack>
  )
}
