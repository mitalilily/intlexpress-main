import { Box } from '@mui/material'
import React from 'react'
import './loader.css'
import BrandMark from '../../brand/BrandMark'

type Props = {
  night?: boolean
}

const FullScreenLoader: React.FC<Props> = ({ night = false }) => {
  return (
    <Box className={`loader-overlay ${night ? 'night' : ''}`}>
      <Box className="loader-content">
        <div className="logo-container">
          <BrandMark variant="icon" width={116} className="loader-logo" />
          <div className="pulse-ring"></div>
          <div className="pulse-ring pulse-ring-delay"></div>
        </div>
      </Box>
    </Box>
  )
}

export default FullScreenLoader
