import { Box, Flex, Text, useColorModeValue } from '@chakra-ui/react'
import brand from '../../branding/brand'

export default function BrandLockup({
  compact = false,
  iconSize = 42,
  nameColor,
  taglineColor,
  nameSize,
  tagline = brand.adminTagline,
  withTagline = true,
  textAlign = 'left',
  gap = 3,
}) {
  const resolvedNameColor = nameColor || useColorModeValue('gray.900', 'white')
  const resolvedTaglineColor =
    taglineColor || useColorModeValue('gray.500', 'whiteAlpha.700')

  if (compact) {
    return (
      <Box
        as="img"
        src={brand.logoIcon}
        alt={`${brand.name} logo mark`}
        h={`${iconSize}px`}
        w={`${iconSize}px`}
        objectFit="contain"
        borderRadius="10px"
      />
    )
  }

  return (
    <Flex align="center" gap={gap} minW={0}>
      <Box
        as="img"
        src={brand.logoIcon}
        alt={`${brand.name} logo`}
        h={`${iconSize}px`}
        w={`${iconSize}px`}
        objectFit="contain"
        borderRadius="12px"
        flexShrink={0}
      />
      <Box minW={0} textAlign={textAlign}>
        <Text
          color={resolvedNameColor}
          fontSize={nameSize || { base: 'lg', md: 'xl' }}
          fontWeight="800"
          lineHeight="1"
          letterSpacing="-0.03em"
          whiteSpace="nowrap"
        >
          {brand.name}
        </Text>
        {withTagline ? (
          <Text
            color={resolvedTaglineColor}
            fontSize="10px"
            fontWeight="700"
            lineHeight="1.2"
            letterSpacing="0.14em"
            textTransform="uppercase"
            mt={1}
            whiteSpace="nowrap"
          >
            {tagline}
          </Text>
        ) : null}
      </Box>
    </Flex>
  )
}
