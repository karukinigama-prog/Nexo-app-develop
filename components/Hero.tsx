'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { ArrowRight, CheckCircle, Sparkles, Zap, Brain, Shield, Globe, Code } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { models } from '@/lib/models'

export function Hero() {
  const [isAnimating, setIsAnimating] = useState(false)
  const [activeModel, setActiveModel] = useState(models[0])

  const features = [
    { icon: Zap, label: 'Lightning Fast', desc: 'Sub-second responses for everyday tasks' },
    { icon: Brain, label: 'Smart Reasoning', desc: 'Handles logic, code, and creative writing' },
    { icon: Shield, label: 'Privacy First', desc: 'Your data stays yours, no training on chats' },
    { icon: Globe, label: 'Sinhala & English', desc: 'Native bilingual support out of the box' },
    { icon: Code, label: 'Code Assistant', desc: 'Write, debug, and explain code instantly' },
    { icon: Sparkles, label: 'Always Free', desc: 'No credit card, no limits, no catch' },
  ]

  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden bg-gradient-to-b from-background via-background to-muted/30 dark:from-background dark:via-background dark:to-muted/30">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-from)_0%,_transparent_70%)] from-primary/5 via-transparent to-transparent" />
      <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-3 max-w-[800px] mx-auto" />
      
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
        className="relative z-10 max-w-6xl mx-auto px-4 py-20 text-center"
      >
        <div className="mb-8 flex flex-wrap items-center justify-center gap-2">
          <span className="px-3 py-1 text-xs font-medium rounded-full bg-primary/10 text-primary border border-primary/20">
            <Sparkles className="mr-1 h-3 w-3" /> Now with Memory & Reasoning
          </span>
          <span className="px-3 py-1 text-xs font-medium rounded-full bg-green-500/10 text-green-500 border border-green-500/20">
            <CheckCircle className="mr-1 h-3 w-3" /> Free Forever
          </span>
        </div>

        <h1 className="mb-6 text-5xl font-bold tracking-tight sm:text-6xl md:text-7xl lg:text-8xl bg-gradient-to-r from-foreground via-primary to-foreground bg-clip-text text-transparent animate-gradient">
          NEXO <span className="text-primary">Nexio</span> 1.1
        </h1>
        <p className="mb-10 max-w-3xl mx-auto text-lg text-muted-foreground sm:text-xl md:text-2xl leading-relaxed">
          Your everyday AI assistant — fast, friendly, and fluent in Sinhala & English.
          <br />
          <span className="font-medium text-foreground">No login required. Just start chatting.</span>
        </p>

        <div className="mb-10 flex flex-wrap items-center justify-center gap-4">
          <Button
            size="lg"
            className="group w-full sm:w-auto px-8 py-4 text-lg gap-2"
            asChild
          >
            <Link href="/chat">
              Start Chatting Free
              <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
            </Link>
          </Button>
          <Button
            size="lg"
            variant="outline"
            className="w-full sm:w-auto px-8 py-4 text-lg"
            asChild
          >
            <Link href="/models">Explore Models</Link>
          </Button>
        </div>

        <div className="mb-16 flex flex-wrap items-center justify-center gap-6 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <CheckCircle className="h-4 w-4 text-green-500" />
            No account needed
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle className="h-4 w-4 text-green-500" />
            Unlimited messages
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle className="h-4 w-4 text-green-500" />
            Works offline (PWA)
          </div>
        </div>

        <div className="relative max-w-4xl mx-auto">
          <div className="absolute -top-4 -right-4 h-8 w-8 rounded-full bg-primary/20 blur-2xl" />
          <div className="absolute -bottom-4 -left-4 h-8 w-8 rounded-full bg-primary/20 blur-2xl" />
          
          <div className="relative bg-card/50 backdrop-blur-sm border border-border/50 rounded-2xl p-4 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="flex -space-x-2">
                  {models.slice(0, 3).map((model) => (
                    <div
                      key={model.id}
                      className={cn(
                        'h-8 w-8 rounded-full border-2 border-background flex items-center justify-center text-xs font-medium transition-all duration-200',
                        activeModel.id === model.id
                          ? 'bg-primary text-primary-foreground scale-110 z-10 shadow-lg'
                          : 'bg-muted text-muted-foreground hover:scale-105'
                      )}
                    >
                      {model.icon}
                    </div>
                  ))}
                </div>
                <span className="text-sm font-medium text-foreground">
                  {activeModel.name} <span className="text-xs text-muted-foreground font-normal">• {activeModel.tagline}</span>
                </span>
              </div>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                <Sparkles className="h-4 w-4" />
              </Button>
            </div>
            
            <div className="space-y-3">
              {[
                { role: 'user', content: 'Hey Nexio, what\'s the capital of Sri Lanka?' },
                { role: 'assistant', content: 'Sri Jayawardenepura Kotte is the legislative capital, while Colombo is the commercial capital and largest city. 🇱🇰' },
                { role: 'user', content: 'ස්රී ලංකාවේ රාජධානිය කුමක්ද?' },
                { role: 'assistant', content: 'ශ්‍රී ජයවර්ධනපුර කෝට්ටු නියෝජිත රාජධානියයි, කොළඹ වෙළඳ රාජධානිය සහ විශාලතම නගරයයි. 🇱🇰' },
              ].map((msg, i) => (
                <div
                  key={i}
                  className={cn(
                    'flex gap-3 px-3 py-2 rounded-xl text-sm transition-opacity',
                    msg.role === 'user' ? 'justify-end' : 'justify-start'
                  )}
                >
                  {msg.role === 'assistant' && (
                    <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <Sparkles className="h-3 w-3 text-primary" />
                    </div>
                  )}
                  <div
                    className={cn(
                      'max-w-[70%] px-4 py-2 rounded-2xl text-sm',
                      msg.role === 'user'
                        ? 'bg-primary text-primary-foreground rounded-br-sm'
                        : 'bg-muted rounded-bl-sm'
                    )}
                  >
                    {msg.content}
                  </div>
                  {msg.role === 'user' && (
                    <div className="h-6 w-6 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                      <span className="text-xs font-medium text-muted-foreground">U</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
            
            <div className="mt-4 flex items-center justify-center gap-2">
              <input
                type="text"
                placeholder="Message Nexio..."
                className="h-10 w-full max-w-md px-4 bg-background border border-border rounded-full text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <Button size="icon" className="h-10 w-10">
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        <div className="mt-16 grid grid-cols-2 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
          {features.map((feature, i) => (
            <motion.div
              key={feature.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.2 + i * 0.05 }}
              className="group p-6 bg-card/50 backdrop-blur-sm border border-border/50 rounded-xl hover:border-primary/50 transition-all duration-300"
            >
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                <feature.icon className="h-6 w-6" />
              </div>
              <h3 className="mb-1 font-semibold text-foreground">{feature.label}</h3>
              <p className="text-sm text-muted-foreground">{feature.desc}</p>
            </motion.div>
          ))}
        </div>
      </motion.div>
    </section>
  )
}