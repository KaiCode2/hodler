
import React from "react";
import { Navbar } from "@/components/Navbar";
import { Dashboard } from "@/pageTemplates/Dashboard";

export default function AppPage(): JSX.Element {

    return (
        <div>
            <Navbar />
            <Dashboard />
        </div>
    );
}

