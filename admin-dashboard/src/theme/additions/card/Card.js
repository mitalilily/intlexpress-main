const Card = {
  baseStyle: {
    p: '22px',
    display: 'flex',
    flexDirection: 'column',
    width: '100%',
    position: 'relative',
    minWidth: '0px',
    wordWrap: 'break-word',
    backgroundClip: 'border-box',
  },
  variants: {
    panel: (props) => ({
      bg: props.colorMode === 'dark' ? '#101D36' : 'white',
      width: '100%',
      border: props.colorMode === 'dark' ? '1px solid rgba(148, 163, 184, 0.18)' : '1px solid rgba(51, 61, 129, 0.1)',
      boxShadow:
        props.colorMode === 'dark'
          ? '0 18px 40px rgba(2, 8, 23, 0.34)'
          : '0 16px 36px rgba(35, 41, 93, 0.08)',
      borderRadius: '8px',
      overflow: 'hidden',
    }),
  },
  defaultProps: {
    variant: 'panel',
  },
}

export const CardComponent = {
  components: {
    Card,
  },
}
