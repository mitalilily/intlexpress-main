// src/pages/client/RateCard.tsx

import {
  Avatar,
  Box,
  Card,
  CardContent,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material'
import Papa from 'papaparse'
import { useState } from 'react'
import { MdCalculate, MdDownload } from 'react-icons/md'
import { useNavigate } from 'react-router-dom'
import { FilterBar, type FilterField } from '../../components/FilterBar'
import ListPageLayout from '../../components/UI/layout/ListPageLayout'
import { SmartTabs } from '../../components/UI/tab/Tabs'
import type { Column } from '../../components/UI/table/DataTable'
import DataTable from '../../components/UI/table/DataTable'
import TableSkeleton from '../../components/UI/table/TableSkeleton'
import { useAllCouriers, useShippingRates } from '../../hooks/Integrations/useCouriers'
import { useZones } from '../../hooks/useZones'
import { courierLogos, defaultLogo } from '../../utils/constants'

interface ShippingRate {
  id: string | number
  courier_name: string
  mode: string
  min_weight: number
  cod_charges?: number | string
  cod_percent?: number | string
  other_charges?: number | string
  rates: {
    [zone: string]: {
      forward?: number | string
      rto?: number | string
      reverse?: number | string
      description?: string
      forward_per_kg?: number | string
      rto_per_kg?: number | string
      reverse_per_kg?: number | string
      min_weight?: number
    }
  }
}

type ZoneRateMap = ShippingRate['rates'][string]

const pickZoneRateValue = (
  zoneRates: ZoneRateMap | undefined,
  keys: Array<keyof ZoneRateMap>,
): number | string => {
  for (const key of keys) {
    const value = zoneRates?.[key]
    if (value !== undefined && value !== null && value !== '') {
      return value
    }
  }

  return 'NA'
}

const getForwardRateValue = (zoneRates: ZoneRateMap | undefined, businessType: 'b2b' | 'b2c') =>
  pickZoneRateValue(zoneRates, businessType === 'b2b' ? ['forward_per_kg', 'forward'] : ['forward'])

const getRtoRateValue = (zoneRates: ZoneRateMap | undefined, businessType: 'b2b' | 'b2c') =>
  pickZoneRateValue(zoneRates, businessType === 'b2b' ? ['rto_per_kg', 'rto'] : ['rto'])

const getReverseRateValue = (zoneRates: ZoneRateMap | undefined, businessType: 'b2b' | 'b2c') =>
  pickZoneRateValue(
    zoneRates,
    businessType === 'b2b'
      ? ['reverse_per_kg', 'reverse', 'rto_per_kg', 'rto']
      : ['reverse', 'rto'],
  )

// --- B2C Table ---
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const B2CClientTable = ({ data, zones }: { data: ShippingRate[]; zones: any[] }) => {
  const columns: Column<ShippingRate>[] = [
    {
      id: 'courier_name',
      label: 'Courier',
      render: (_, row) => {
        const logoSrc =
          Object.entries(courierLogos)?.find(([key]) =>
            row?.courier_name?.toLowerCase().includes(key.toLowerCase()),
          )?.[1] ?? defaultLogo
        return (
          <Stack direction="row" alignItems="center" spacing={1}>
            <Avatar
              src={logoSrc || defaultLogo}
              alt={row.courier_name}
              sx={{ width: 24, height: 24 }}
            />
            <Typography fontWeight={500}>{row.courier_name}</Typography>
          </Stack>
        )
      },
    },
    { id: 'min_weight', label: 'Min Weight (kg)' },
    ...zones.map(
      (zone: { code: string; description: string; name: string }) =>
        ({
          id: zone.code,
          label: `${zone.name} (F | RTO | Reverse)`,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          render: (_: any, row: any) => {
            const rates = row.rates?.[zone.name]
            const forward = getForwardRateValue(rates, 'b2c')
            const rto = getRtoRateValue(rates, 'b2c')
            const reverse = getReverseRateValue(rates, 'b2c')

            return `F: ₹${forward} | RTO: ₹${rto} | Reverse: ₹${reverse}`
          },
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        }) as any,
    ),

    {
      id: 'cod',
      label: 'COD (Charges | %)',
      render: (_, row) => `₹${row.cod_charges ?? '0'} | ${row.cod_percent ?? '0'}%`,
    },
    {
      id: 'other',
      label: 'Other Charges',
      render: (_, row) => `₹${row.other_charges ?? '0'}`,
    },
  ]

  return (
    <DataTable
      rows={data}
      columns={columns}
      title="Shipping Rate Card - B2C"
      totalCount={data.length}
    />
  )
}

// --- B2B Table ---
const B2BClientTable = ({
  data,
  zones,
}: {
  data: ShippingRate[]
  zones: { code: string; id: string; description: string; name: string }[]
}) => {
  if (!data?.length) {
    return <Typography>No B2B rates available</Typography>
  }

  return (
    <Stack spacing={3}>
      {data.map((courier) => (
        <Card key={courier.courier_name} sx={{ p: 2 }}>
          <CardContent>
            <Stack spacing={1}>
              <Typography variant="h6">{courier.courier_name}</Typography>
              <Typography variant="body2">Min Weight: {courier.min_weight} kg</Typography>
              <Typography variant="body2">
                COD: ₹{courier.cod_charges ?? '0'} | {courier.cod_percent ?? '0'}%
              </Typography>
              <Typography variant="body2">Other: ₹{courier.other_charges ?? '0'}</Typography>
            </Stack>

            <Table size="small" sx={{ mt: 2 }}>
              <TableHead>
                <TableRow>
                  <TableCell>Zone</TableCell>
                  <TableCell>Forward (Per Kg)</TableCell>
                  <TableCell>RTO (Per Kg)</TableCell>
                  <TableCell>Reverse (Per Kg)</TableCell>
                  <TableCell>Min Weight</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {zones.map((zone) => {
                  const rates = courier.rates?.[zone.name]
                  return (
                    <TableRow key={zone.code}>
                      <TableCell>{zone.name}</TableCell>
                      <TableCell>₹{getForwardRateValue(rates, 'b2b')}</TableCell>
                      <TableCell>₹{getRtoRateValue(rates, 'b2b')}</TableCell>
                      <TableCell>₹{getReverseRateValue(rates, 'b2b')}</TableCell>
                      <TableCell>{rates?.min_weight ?? courier.min_weight ?? 'NA'} kg</TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ))}
    </Stack>
  )
}

// --- Main Component ---
const RateCard = () => {
  const navigate = useNavigate()
  const [businessType, setBusinessType] = useState<'b2c' | 'b2b'>('b2c')
  const [filters, setFilters] = useState({
    courier: [] as string[],
    min_weight: '',
  })

  const { zones } = useZones(businessType)
  const { data: couriers } = useAllCouriers()
  const { data, isLoading, isError } = useShippingRates({ ...filters, businessType })

  const rates: ShippingRate[] = data || []

  const handleExportCSV = (): void => {
    const csvData = rates.map((rateRow) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const base: Record<string, any> = {
        Courier: rateRow.courier_name,
        Mode: rateRow.mode,
        'Min Weight': rateRow.min_weight,
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      zones.forEach((zone: any) => {
        const zoneRates = rateRow.rates?.[zone.name]
        if (businessType === 'b2b') {
          base[`${zone.name} (Per Kg)`] = `F: ₹${getForwardRateValue(zoneRates, 'b2b')} | RTO: ₹${getRtoRateValue(
            zoneRates,
            'b2b',
          )} | Reverse: ₹${getReverseRateValue(zoneRates, 'b2b')}`
        } else {
          base[`${zone.name} (F | RTO | Reverse)`] = `F: ₹${getForwardRateValue(
            zoneRates,
            'b2c',
          )} | RTO: ₹${getRtoRateValue(zoneRates, 'b2c')} | Reverse: ₹${getReverseRateValue(
            zoneRates,
            'b2c',
          )}`
        }
      })

      base['COD Charges'] = rateRow.cod_charges ?? 'N/A'
      base['COD %'] = rateRow.cod_percent ?? 'N/A'
      base['Other Charges'] = rateRow.other_charges ?? 'N/A'

      return base
    })

    const csv = Papa.unparse(csvData)
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.setAttribute('download', `rate_card_${businessType}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const filterFields: FilterField[] = [
    {
      name: 'courier',
      label: 'Courier',
      type: 'multiselect',
      options: couriers?.map((c: string) => ({ label: c, value: c })) || [],
    },
    { name: 'min_weight', label: 'Min Weight (kg)', type: 'text', placeholder: 'Enter min weight' },
  ]

  const controls = (
    <Box sx={{ px: 2 }}>
      <Stack
        direction={{ xs: 'column', md: 'row' }}
        justifyContent="space-between"
        alignItems="center"
      >
        <Box>
          <SmartTabs
            tabs={[
              { label: 'B2C', value: 'b2c' },
              { label: 'B2B', value: 'b2b' },
            ]}
            value={businessType}
            onChange={(value) => setBusinessType(value)}
          />
        </Box>
        <FilterBar
          fields={filterFields}
          defaultValues={filters}
          onApply={(applied) => {
            setFilters((prev) => ({
              ...prev,
              ...applied,
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              courier: applied?.courier?.map((cour) => (cour as any)?.value),
            }))
          }}
          mode="button"
          buttonLabel="Filters"
          appliedCount={Object.values(filters).filter(Boolean).length}
        />
      </Stack>
    </Box>
  )

  const table = isLoading ? (
    <TableSkeleton />
  ) : isError ? (
    <Typography color="error">Error loading shipping rates</Typography>
  ) : businessType === 'b2b' ? (
    <B2BClientTable zones={zones} data={rates} />
  ) : (
    <B2CClientTable data={rates} zones={zones} />
  )

  return (
    <ListPageLayout
      title="Rate Card"
      description="View and manage shipping rates for your couriers"
      actions={[
        {
          label: 'Calculate Rates',
          onClick: () => navigate('/tools/rate_calculator'),
          icon: <MdCalculate />,
          variant: 'outlined',
        },
        {
          label: 'Download Rate Card',
          onClick: handleExportCSV,
          icon: <MdDownload />,
          variant: 'contained',
        },
      ]}
      controls={controls}
    >
      {table}
    </ListPageLayout>
  )
}

export default RateCard
