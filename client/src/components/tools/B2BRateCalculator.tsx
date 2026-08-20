import { Grid, MenuItem } from '@mui/material'
import { useFormContext } from 'react-hook-form'
import CustomInput from '../UI/inputs/CustomInput'

export default function B2BRateCalculator() {
  const { register } = useFormContext()

  return (
    <Grid container spacing={2}>
      <Grid size={6}>
        <CustomInput label="Total Weight (kg)" {...register('totalWeight')} fullWidth />
      </Grid>
      <Grid size={6}>
        <CustomInput label="Number of Boxes" {...register('numberOfBoxes')} fullWidth />
      </Grid>
      <Grid size={6}>
        <CustomInput label="Freight Mode" {...register('freightMode')} fullWidth select>
          <MenuItem value="bill_to_client">Bill to client</MenuItem>
          <MenuItem value="freight_on_delivery">Freight on delivery</MenuItem>
        </CustomInput>
      </Grid>
      <Grid size={6}>
        <CustomInput label="ROV Type" {...register('rovType')} fullWidth select>
          <MenuItem value="owner_risk">ROV by owner</MenuItem>
          <MenuItem value="carrier_risk">ROV by courier</MenuItem>
        </CustomInput>
      </Grid>
    </Grid>
  )
}
