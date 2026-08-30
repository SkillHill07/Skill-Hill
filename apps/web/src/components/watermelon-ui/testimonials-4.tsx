"use client";

import * as React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
} from "@/components/ui/carousel";
import Autoplay from "embla-carousel-autoplay";
import { Quote } from "lucide-react";

const testimonials = [
  {
    name: "Priya Sharma",
    role: "SDE-2 at Flipkart",
    avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Priya",
    content:
      "Won ₹2,000 in my third contest. The instant prize payout to my wallet is amazing — no waiting, no hassle.",
  },
  {
    name: "Arjun Mehta",
    role: "CS Student, IIT Delhi",
    avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Arjun",
    content:
      "The practice library helped me prepare for real contests. Solved 50+ problems before winning my first prize.",
  },
  {
    name: "Neha Gupta",
    role: "Backend Engineer at Razorpay",
    avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Neha",
    content:
      "Fair judging, real problems, real money. SkillHill is the only platform where I can test my skills and earn.",
  },
  {
    name: "Rohan Verma",
    role: "Full-Stack Developer",
    avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Rohan",
    content:
      "The live leaderboard keeps the adrenaline going. I've won 5 contests so far — the competition is real.",
  },
  {
    name: "Kavya Patel",
    role: "SDE-1 at Google",
    avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Kavya",
    content:
      "Started as practice, now I compete weekly. The ₹20 entry fee makes it accessible for everyone.",
  },
  {
    name: "Vikram Singh",
    role: "Competitive Programmer",
    avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Vikram",
    content:
      "Instant judging, hidden test cases, real leaderboard — this is how competitive programming should be.",
  },
];

export default function Testimonials4() {
  const plugin = React.useMemo(
    () =>
      Autoplay({
        delay: 3000,
        stopOnInteraction: false,
        stopOnMouseEnter: true,
        playOnInit: true,
      }),
    [],
  );

  return (
    <section className="w-full py-16 md:py-24">
      <div className="mx-auto max-w-6xl px-4 md:px-6">
        <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-2 lg:gap-8">
          <div className="flex flex-col items-start space-y-4 text-left">
            <p className="text-xs font-semibold uppercase tracking-widest text-orange-600 dark:text-orange-400">
              Wall of Fame
            </p>
            <h2 className="text-foreground text-4xl font-semibold md:text-5xl">
              Winners speak
            </h2>
            <p className="text-muted-foreground max-w-sm">
              Real people. Real contests. Real prizes credited to their wallets.
            </p>
          </div>

          <div className="relative h-[400px] w-full rounded-lg lg:h-[500px]">
            <div className="from-background pointer-events-none absolute top-0 right-0 left-0 z-10 h-20 bg-gradient-to-b to-transparent" />

            <Carousel
              orientation="vertical"
              opts={{
                loop: true,
                align: "start",
              }}
              plugins={[plugin]}
              onMouseEnter={plugin.stop}
              onMouseLeave={() => plugin.reset()}
              className="h-full w-full [&_[data-slot=carousel-content]]:h-[400px] lg:[&_[data-slot=carousel-content]]:h-[500px]"
            >
              <CarouselContent className="-mt-4">
                {testimonials.map((testimonial, index) => (
                  <CarouselItem key={index} className="basis-auto pt-4">
                    <Card className="bg-muted/50 rounded-3xl ring-0 transition-all duration-200">
                      <CardContent className="flex flex-col gap-4 p-5">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <Avatar className="rounded-lg">
                              <AvatarImage
                                src={testimonial.avatar}
                                alt={testimonial.name}
                              />
                              <AvatarFallback>
                                {testimonial.name
                                  .split(" ")
                                  .map((n) => n[0])
                                  .join("")}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex flex-col">
                              <span className="text-foreground text-sm font-medium">
                                {testimonial.name}
                              </span>
                              <span className="text-muted-foreground text-xs">
                                {testimonial.role}
                              </span>
                            </div>
                          </div>
                          <Quote className="h-5 w-5 fill-orange-500 text-orange-500" />
                        </div>
                        <p className="text-foreground text-sm leading-relaxed">
                          &quot;{testimonial.content}&quot;
                        </p>
                      </CardContent>
                    </Card>
                  </CarouselItem>
                ))}
              </CarouselContent>
            </Carousel>

            <div className="from-background pointer-events-none absolute right-0 bottom-0 left-0 z-10 h-20 bg-gradient-to-t to-transparent" />
          </div>
        </div>
      </div>
    </section>
  );
}
