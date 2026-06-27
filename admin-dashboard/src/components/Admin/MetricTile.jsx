import { Box, Flex, Text, useColorModeValue } from '@chakra-ui/react'

export default function MetricTile({
  icon,
  label,
  value,
  accent = 'brand.500',
  muted,
  onClick,
  active = false,
}) {
  const bg = useColorModeValue('white', 'rgba(14, 23, 43, 0.9)')
  const borderColor = active
    ? useColorModeValue('rgba(51, 61, 129, 0.34)', 'rgba(111, 132, 239, 0.34)')
    : useColorModeValue('rgba(51, 61, 129, 0.14)', 'rgba(148, 163, 184, 0.16)')
  const titleColor = useColorModeValue('gray.500', 'gray.400')
  const valueColor = useColorModeValue('gray.800', 'white')
  const iconBg = useColorModeValue('rgba(51, 61, 129, 0.08)', 'rgba(255,255,255,0.06)')
  const hoverBorderColor = useColorModeValue('rgba(51, 61, 129, 0.28)', 'rgba(111, 132, 239, 0.28)')
  const hoverShadow = useColorModeValue('0 18px 40px rgba(35, 41, 93, 0.1)', '0 20px 48px rgba(2, 8, 23, 0.42)')

  return (
    <Flex
      direction="column"
      justify="space-between"
      minH="136px"
      p={4.5}
      borderRadius="8px"
      borderWidth="1px"
      borderColor={borderColor}
      bg={bg}
      boxShadow={useColorModeValue('0 14px 34px rgba(15, 23, 42, 0.05)', '0 16px 40px rgba(2, 8, 23, 0.32)')}
      cursor={onClick ? 'pointer' : 'default'}
      transition="transform 0.18s ease, border-color 0.18s ease, box-shadow 0.18s ease"
      _hover={
        onClick
          ? {
              transform: 'translateY(-2px)',
              borderColor: hoverBorderColor,
              boxShadow: hoverShadow,
            }
          : undefined
      }
      onClick={onClick}
    >
      <Flex align="center" justify="space-between" mb={5}>
        <Text fontSize="xs" fontWeight="700" textTransform="uppercase" letterSpacing="0.1em" color={titleColor}>
          {label}
        </Text>
        <Flex
          align="center"
          justify="center"
          w="42px"
          h="42px"
          borderRadius="6px"
          bg={iconBg}
          color={accent}
        >
          {icon}
        </Flex>
      </Flex>
      <Box>
        <Text fontSize={{ base: '2xl', md: '3xl' }} fontWeight="800" letterSpacing="-0.03em" color={valueColor}>
          {value}
        </Text>
        {muted ? (
          <Text mt={1.5} fontSize="sm" color={titleColor}>
            {muted}
          </Text>
        ) : null}
      </Box>
    </Flex>
  )
}
