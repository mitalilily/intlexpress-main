import { mode } from '@chakra-ui/theme-tools'
import colors from './foundations/colors'

export const globalStyles = {
  colors: {
    ...colors,
  },
  styles: {
    global: (props) => ({
      body: {
        bg: mode('#F3F6FE', '#09111F')(props),
        color: mode('gray.800', 'gray.100')(props),
        fontFamily: "'Open Sans', 'Segoe UI', sans-serif",
        backgroundImage: mode(
          'radial-gradient(circle at 8% 10%, rgba(51, 61, 129, 0.12) 0%, transparent 34%), radial-gradient(circle at 95% 0%, rgba(206, 40, 38, 0.06) 0%, transparent 24%), linear-gradient(180deg, #f7f9ff 0%, #eef2fb 100%)',
          'radial-gradient(circle at 10% 8%, rgba(91, 102, 177, 0.24) 0%, transparent 38%), radial-gradient(circle at 90% 0%, rgba(206, 40, 38, 0.08) 0%, transparent 24%), linear-gradient(180deg, #09111F 0%, #0F172A 100%)',
        ),
      },
      html: {
        fontFamily: "'Open Sans', 'Segoe UI', sans-serif",
      },
      '#root': {
        minHeight: '100vh',
      },
      '::selection': {
        background: mode('brand.200', 'brand.600')(props),
      },
    }),
  },
}
