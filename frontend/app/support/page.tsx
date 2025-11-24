'use client';

import { Navbar } from '@/components/navbar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Mail, Code, Heart, ExternalLink } from 'lucide-react';

export default function SupportPage() {

  const developerName = 'Zayeem Zaki';
  const developerEmail = 'zayeemzaki45@gmail.com';

  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-background text-foreground pt-0 md:pt-16 pb-24 md:pb-8 px-4 sm:px-6 lg:px-8 overflow-y-auto">
        <div className="max-w-4xl mx-auto">
          {/* Page Header */}
          <div className="pt-4 md:pt-6 mb-6 md:mb-8">
            <h1 className="text-2xl md:text-3xl font-bold mb-1 md:mb-2">Support</h1>
            <p className="text-sm md:text-base text-muted-foreground">
              Get help, report issues, or reach out to the developer
            </p>
          </div>

          <div className="space-y-6">
            {/* Developer Information Card */}
            <Card className="bg-card text-card-foreground border-border">
              <CardHeader className="pb-3 md:pb-6">
                <div className="flex items-center gap-2">
                  <Code className="w-4 md:w-5 h-4 md:h-5 text-primary" />
                  <CardTitle className="text-base md:text-lg">Building Scalable AI Solutions & Robust Systems</CardTitle>
                </div>
                <CardDescription className="text-xs md:text-sm text-muted-foreground">
                  Built with passion for the investment community
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-start gap-3">
                  <Heart className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-sm md:text-base font-semibold text-foreground mb-1">
                      {developerName}
                    </p>
                    <p className="text-xs md:text-sm text-muted-foreground">
                      Developed and maintained Stock Read
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Contact Information Card */}
            <Card className="bg-card text-card-foreground border-border">
              <CardHeader className="pb-3 md:pb-6">
                <div className="flex items-center gap-2">
                  <Mail className="w-4 md:w-5 h-4 md:h-5 text-primary" />
                  <CardTitle className="text-base md:text-lg">Contact</CardTitle>
                </div>
                <CardDescription className="text-xs md:text-sm text-muted-foreground">
                  Have questions or need assistance? Reach out!
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-3 p-4 bg-muted rounded-lg border border-border">
                  <Mail className="w-5 h-5 text-primary flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-muted-foreground mb-1">Email for queries</p>
                    <a
                      href={`mailto:${developerEmail}?subject=Stock Read Support`}
                      className="text-sm md:text-base font-medium text-primary hover:underline break-all"
                    >
                      {developerEmail}
                    </a>
                  </div>
                </div>
                <p className="text-xs md:text-sm text-muted-foreground">
                  Feel free to reach out for bug reports, feature requests, or any questions about the platform.
                </p>
              </CardContent>
            </Card>

            {/* Additional Information Card */}
            <Card className="bg-card text-card-foreground border-border">
              <CardHeader className="pb-3 md:pb-6">
                <CardTitle className="text-base md:text-lg">Need Help?</CardTitle>
                <CardDescription className="text-xs md:text-sm text-muted-foreground">
                  Common ways to get assistance
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-2">
                  <div className="p-3 bg-muted rounded-lg border border-border">
                    <p className="text-sm font-medium text-foreground mb-1">Bug Reports</p>
                    <p className="text-xs text-muted-foreground">
                      Found an issue? Email us with details about what happened and we&apos;ll look into it.
                    </p>
                  </div>
                  <div className="p-3 bg-muted rounded-lg border border-border">
                    <p className="text-sm font-medium text-foreground mb-1">Feature Requests</p>
                    <p className="text-xs text-muted-foreground">
                      Have an idea to improve Stock Read? We&apos;d love to hear from you!
                    </p>
                  </div>
                  <div className="p-3 bg-muted rounded-lg border border-border">
                    <p className="text-sm font-medium text-foreground mb-1">General Questions</p>
                    <p className="text-xs text-muted-foreground">
                      Questions about how the platform works? Don&apos;t hesitate to reach out.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Footer */}
          <footer className="mt-12 md:mt-16 pt-8 pb-4 border-t border-border">
            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="text-center md:text-left">
                <p className="text-sm text-muted-foreground">
                  © {new Date().getFullYear()} Curated Byte LLC. All rights reserved.
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Developed by {developerName}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <a
                  href="https://www.zayeemzaki.com/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-sm text-primary hover:underline transition-colors"
                >
                  <span>Visit my website</span>
                  <ExternalLink className="w-4 h-4" />
                </a>
              </div>
            </div>
          </footer>
        </div>
      </main>
    </>
  );
}

