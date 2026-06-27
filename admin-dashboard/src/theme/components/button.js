export const buttonStyles = {
  components: {
    Button: {
      variants: {
        'no-hover': {
          _hover: {
            boxShadow: 'none',
          },
        },
        'transparent-with-icon': {
          bg: 'transparent',
          fontWeight: '700',
          borderRadius: '8px',
          cursor: 'pointer',
          _active: {
            bg: 'transparent',
            transform: 'none',
            borderColor: 'transparent',
          },
          _focus: {
            boxShadow: 'none',
          },
          _hover: {
            bg: 'rgba(51, 61, 129, 0.08)',
          },
        },
      },
      baseStyle: {
        borderRadius: '8px',
        fontWeight: '700',
        _focus: {
          boxShadow: 'none',
        },
      },
    },
  },
}
