// hooks/useShippingRates.js
import { useToast } from '@chakra-ui/react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  cancelDelhiveryB2BShipment,
  checkDelhiveryB2BServiceability,
  createDelhiveryB2BClientWarehouse,
  createDelhiveryB2BShipment,
  createCourier,
  deleteCourier,
  deleteShippingRateAPI,
  estimateDelhiveryB2BFreight,
  estimateDelhiveryB2BTat,
  fetchCourierCredentials,
  fetchAllCouriersList,
  fetchAvailableCouriers,
  fetchServiceProviders,
  fetchShippingRates,
  getDelhiveryB2BFreightCharges,
  getDelhiveryB2BShipmentStatus,
  getDelhiveryB2BShipmentUpdateStatus,
  loginDelhiveryB2B,
  logoutDelhiveryB2B,
  triggerDelhiveryForgotPassword,
  updateDelhiveryCredentials,
  updateCourierStatus,
  updateDelhiveryB2BClientWarehouse,
  updateDelhiveryB2BShipment,
  updateServiceProviderStatus,
  updateShippingRate,
  uploadShippingRates,
} from '../services/courier.service'

export const useCouriers = (filters = {}) => {
  return useQuery({
    queryKey: ['couriers', filters],
    queryFn: () => fetchAllCouriersList(filters),
    staleTime: 5 * 120 * 1000, // 5 minutes cache
    retry: 1,
  })
}

export const useCreateCourier = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: createCourier,
    onSuccess: () => {
      queryClient.invalidateQueries(['couriers'])
    },
  })
}

export const useAvailableCouriersMutation = () => {
  return useMutation({
    mutationFn: (params) => {
      const parsedOrderAmount = Number(params.orderAmount ?? 0)
      const normalizedOrderAmount = parsedOrderAmount > 0 ? parsedOrderAmount : undefined

      return fetchAvailableCouriers({
        origin: params.pickupPincode,
        destination: params.deliveryPincode,
        pickupId: params.pickupId,
        payment_type: params.paymentType ?? (params.cod && params.cod > 0 ? 'cod' : 'prepaid'),
        order_amount: normalizedOrderAmount,
        weight: params.weight,
        length: params.length,
        breadth: params.breadth,
        height: params.height,
        shipment_type: params?.shipmentType,
        plan_id: params?.planId,
        isReverse: params?.shipmentType === 'reverse',
        isCalculator: params?.isCalculator === true || params?.context === 'rate_calculator',
      })
    },
    retry: 1,
  })
}

export const useDeleteCourier = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: deleteCourier,
    onSuccess: () => {
      queryClient.invalidateQueries(['couriers'])
    },
  })
}

export const useUpdateCourierStatus = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: updateCourierStatus,
    onSuccess: () => {
      queryClient.invalidateQueries(['couriers'])
    },
  })
}

export const useServiceProviders = () => {
  return useQuery({
    queryKey: ['serviceProviders'],
    queryFn: () => fetchServiceProviders(),
    staleTime: 5 * 60 * 1000,
  })
}

export const useUpdateServiceProviderStatus = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: updateServiceProviderStatus,
    onSuccess: () => {
      queryClient.invalidateQueries(['serviceProviders'])
      queryClient.invalidateQueries(['couriers'])
    },
  })
}

export const useCourierCredentials = () => {
  return useQuery({
    queryKey: ['courierCredentials'],
    queryFn: fetchCourierCredentials,
    staleTime: 60 * 1000,
  })
}

export const useUpdateDelhiveryCredentials = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: updateDelhiveryCredentials,
    onSuccess: () => {
      queryClient.invalidateQueries(['courierCredentials'])
    },
  })
}

export const useDelhiveryForgotPassword = () =>
  useMutation({
    mutationFn: triggerDelhiveryForgotPassword,
  })

export const useDelhiveryB2BLogin = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: loginDelhiveryB2B,
    onSuccess: () => {
      queryClient.invalidateQueries(['courierCredentials'])
    },
  })
}

export const useDelhiveryB2BLogout = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: logoutDelhiveryB2B,
    onSuccess: () => {
      queryClient.invalidateQueries(['courierCredentials'])
    },
  })
}

export const useDelhiveryB2BServiceability = () =>
  useMutation({
    mutationFn: checkDelhiveryB2BServiceability,
  })

export const useDelhiveryB2BTat = () =>
  useMutation({
    mutationFn: estimateDelhiveryB2BTat,
  })

export const useDelhiveryB2BFreightEstimate = () =>
  useMutation({
    mutationFn: estimateDelhiveryB2BFreight,
  })

export const useDelhiveryB2BFreightCharges = () =>
  useMutation({
    mutationFn: getDelhiveryB2BFreightCharges,
  })

export const useDelhiveryB2BClientWarehouseCreate = () =>
  useMutation({
    mutationFn: createDelhiveryB2BClientWarehouse,
  })

export const useDelhiveryB2BClientWarehouseUpdate = () =>
  useMutation({
    mutationFn: updateDelhiveryB2BClientWarehouse,
  })

export const useDelhiveryB2BShipmentCreate = () =>
  useMutation({
    mutationFn: createDelhiveryB2BShipment,
  })

export const useDelhiveryB2BShipmentStatus = () =>
  useMutation({
    mutationFn: getDelhiveryB2BShipmentStatus,
  })

export const useDelhiveryB2BShipmentUpdate = () =>
  useMutation({
    mutationFn: updateDelhiveryB2BShipment,
  })

export const useDelhiveryB2BShipmentUpdateStatus = () =>
  useMutation({
    mutationFn: getDelhiveryB2BShipmentUpdateStatus,
  })

export const useDelhiveryB2BShipmentCancel = () =>
  useMutation({
    mutationFn: cancelDelhiveryB2BShipment,
  })

export const useShippingRates = (filters = {}) => {
  return useQuery({
    queryKey: ['shippingRates', filters],
    queryFn: () => fetchShippingRates(filters),
    staleTime: 5 * 60 * 1000, // 5 minutes
  })
}

export const useUpdateShippingRate = () => {
  const queryClient = useQueryClient()
  const toast = useToast()

  return useMutation({
    mutationFn: async ({ id, updates, planId }) => updateShippingRate(id, updates, planId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shippingRates'] })
      toast({
        title: 'Rate updated successfully.',
        status: 'success',
        duration: 3000,
        isClosable: true,
      })
    },
    onError: (error) => {
      console.error('Failed to update shipping rate:', error)
      toast({
        title: 'Failed to update rate.',
        description: error?.message || 'Something went wrong.',
        status: 'error',
        duration: 4000,
        isClosable: true,
      })
    },
  })
}

export const useImportShippingRates = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: uploadShippingRates,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shippingRates'] })
    },
  })
}

export const useDeleteB2CZone = (planId) => {
  const queryClient = useQueryClient()
  const toast = useToast()

  return useMutation({
    mutationFn: ({ courierId, zoneId, serviceProvider, mode }) =>
      deleteShippingRateAPI({
        courierId,
        planId,
        businessType: 'b2c',
        zoneId,
        serviceProvider,
        mode,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries(['shippingRates'])
      toast({ title: 'B2C zone rate deleted', status: 'success' })
    },
    onError: () => toast({ title: 'Failed to delete B2C zone rate', status: 'error' }),
  })
}

// B2B zone delete
export const useDeleteB2BZone = (planId) => {
  const queryClient = useQueryClient()
  const toast = useToast()

  return useMutation({
    mutationFn: ({ courierId, zoneId }) =>
      deleteShippingRateAPI({ courierId, planId, businessType: 'b2b', zoneId }),
    onSuccess: () => {
      queryClient.invalidateQueries(['shippingRates'])
      toast({ title: 'B2B zone rate deleted', status: 'success' })
    },
    onError: () => toast({ title: 'Failed to delete B2B zone rate', status: 'error' }),
  })
}

// B2B courier delete (all zones)
export const useDeleteB2BCourier = (planId) => {
  const queryClient = useQueryClient()
  const toast = useToast()

  return useMutation({
    mutationFn: (courierId) => deleteShippingRateAPI({ courierId, planId, businessType: 'b2b' }), // no zoneId = delete whole courier
    onSuccess: () => {
      queryClient.invalidateQueries(['shippingRates'])
      toast({ title: 'B2B courier deleted', status: 'success' })
    },
    onError: () => toast({ title: 'Failed to delete B2B courier', status: 'error' }),
  })
}
